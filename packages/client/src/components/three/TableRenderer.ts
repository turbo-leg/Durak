import * as THREE from 'three';
import { SeatedView } from './SeatedView';
import { FirstPersonCharacter, SeatedCharacter } from '../../character/CharacterRig';
import { avatarPreset } from '@durak/shared';
import { CARD_SIZE } from '../../character/spec';
import {
  ACTIONS,
  DRAW_BACK_MS,
  DRAW_SLIDE_MS,
  DRAW_TAKE_MS,
  PICKUP_DRAWN_IN_MS,
  PICKUP_TAKE_MS,
  PLAY_RELEASE_MS,
} from '../../character/animations/registry';
import {
  applyPose,
  clonePose,
  directionToWorld,
  ease,
  flightPoint,
  meshPose,
  samePose,
  toWorld,
  travelTime,
  type CardPose,
} from './CardMotion';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seatStatus, type TableCard, type TableSnapshot } from '../../game/tableSnapshot';
import { SELF, tableEvents, type TableEvent } from '../../game/tableEvents';
import { cardFaceUrl, highResolutionCardFaceUrl } from '../../game/cardArt';
import {
  CHARACTER_SCALE,
  CHARACTER_FLOOR,
  CARRY_DEPTH,
  CARRY_SCALE,
  CARRY_TILT,
  CARRY_RAISE,
  CARRY_Y,
  fanHalfAngle,
  fanStep,
  heldCard,
  HELD_CARD,
  heldCardBow,
  HELD_CARD_SCALE,
  SEAT_RADIUS_X,
  SEAT_RADIUS_Z,
  TABLE_CARD_SCALE,
  TABLE_LAYERS,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  TABLE_TOP,
  tableClearance,
  type Pile,
} from './CharacterSpace';

const RANKS: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: '3',
  15: '2',
  16: 'A',
  17: 'BJ',
  18: 'RJ',
};
// Real-size table layout, in world units: centimetres times CHARACTER_SCALE / 100.
const cm = (value: number) => (value * CHARACTER_SCALE) / 100;
/** Card-relative distances, laid out for a real card and grown with the game's card size. */
const card = (value: number) => cm(value * CARD_SIZE);
/** Where the deck, trump and discard lie, and how far apart table cards sit. */
const LAYOUT = {
  deck: new THREE.Vector3(-card(36), TABLE_TOP, card(1)),
  trump: new THREE.Vector3(-card(25), TABLE_TOP, card(9)),
  discard: new THREE.Vector3(card(36), TABLE_TOP, card(1)),
  spacing: card(9.5),
  attackZ: card(2),
  historyZ: -card(14),
};
const TABLE_CENTRE = new THREE.Vector3(cm(2), TABLE_TOP + cm(3), -cm(4));
const DECK_TOP = LAYOUT.deck.clone().setY(TABLE_TOP + cm(4));
const SUITS: Record<string, string> = { Spades: '♠', Hearts: '♥', Diamonds: '♦', Clubs: '♣' };
// Grow seated players around the held-card height, keeping their grip at the table.
const SEATED_PLAYER_SCALE = CHARACTER_SCALE;
/** Seat labels float just above a seated player's head. */
const labelHeight = (preset: string) =>
  CHARACTER_FLOOR + cm(45 + 105 * (avatarPreset(preset).size ?? 1));
/** Where a card belongs: a pose in `parent`'s frame (the table, the held fan, a peer's fan). */
type Home = CardPose & { parent: THREE.Object3D };
type AnimatedCard = {
  mesh: THREE.Mesh;
  home: Home;
  /** Another card's home to land in instead, such as the fan slot a gathered card fills. */
  follow?: AnimatedCard;
  /** The home the card last set off for; a different home sets it off again. */
  aim?: Home;
  /** Travelling home: from a pose in world space, or within its home's frame. */
  flight?: {
    start: number;
    duration: number;
    from: CardPose;
    velocity: THREE.Vector3;
    world: boolean;
    lift: number;
  };
  /** Kept where it is until `until`; a dealt card waits unseen and then leaves `from`. */
  wait?: { until: number; from?: CardPose };
  /**
   * Taken by a hand: from `from` the card comes into the hand's `grip` over `reach` ms, is
   * held there and let go at `release`. A card that `slide`s is pushed flat across the felt
   * to meet the hand.
   */
  carry?: {
    grip: () => { position: THREE.Vector3; quaternion: THREE.Quaternion } | undefined;
    from: number;
    reach: number;
    release: number;
    slide?: boolean;
    anchor?: CardPose;
  };
  /** The last place drawn, in `frame`, and the speed it was moving at (units per ms). */
  last?: { position: THREE.Vector3; time: number; frame: THREE.Object3D; velocity: THREE.Vector3 };
  removing?: boolean;
  /** A fan slot shown once this card has arrived in it. */
  reveal?: THREE.Object3D;
};
/** Half a lying card's width, length and thickness (world units). */
const CARD_HALF = {
  x: 0.41 * TABLE_CARD_SCALE,
  z: 0.6 * TABLE_CARD_SCALE,
  y: 0.0175 * TABLE_CARD_SCALE,
};
/** The top face of a deck stacked `count` cards high, as the deck is drawn (at most twelve). */
const deckTop = (count: number) =>
  TABLE_TOP + cm(0.3) + (Math.min(12, count) - 1) * cm(0.25) + CARD_HALF.y;
/** Face down on top of the deck. */
const DECK_POSE: CardPose = {
  position: DECK_TOP,
  quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI),
  scale: TABLE_CARD_SCALE,
  bend: 0,
};

export class TableRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(39, 1, 0.025, 70);
  private cards = new Map<string, AnimatedCard>();
  private previousSnapshot?: TableSnapshot;
  private resources = new Set<{ dispose(): void }>();
  private labels = new THREE.Group();
  // The player's cards stay in front of the camera like a hand held by the viewer.
  private hand = new THREE.Group();
  private cardGeometry = this.makeCardGeometry();
  private faces = new Map<string, THREE.MeshStandardMaterial>();
  private edge = new THREE.MeshStandardMaterial({ color: '#d7d6cc', roughness: 0.8 });
  private controls: SeatedView;
  private avatars = new Map<string, SeatedCharacter>();
  private firstHands: FirstPersonCharacter | undefined;
  private ownPreset = '';
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** Seat and pile labels, redrawn only when their own text changes. */
  private labelSprites = new Map<
    string,
    {
      sprite: THREE.Sprite;
      context: CanvasRenderingContext2D;
      texture: THREE.Texture;
      look: string;
    }
  >();
  private hoverKey: string | null = null;
  /** Backs dealt to peers, each flying from the deck into a fan. */
  private dealt = 0;
  /** The deck and discard pile, which hands rest on rather than pass through. */
  private piles: Pile[] = [];
  private clearance = (point: THREE.Vector3, radius?: number, upward?: boolean) =>
    tableClearance(point, radius, upward, this.piles);
  private back: THREE.MeshStandardMaterial;
  private raycaster = new THREE.Raycaster();
  private observer: ResizeObserver;
  private frame = 0;
  private lastRender = 0;
  private disposed = false;
  private mobileQuality = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
  /** A narrow table, drawn at half the display's rate. */
  private compact = false;
  private canSelect = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pointerStart: { x: number; y: number } | null = null;

  constructor(
    private host: HTMLDivElement,
    private select: (key: string) => void,
    private failed: () => void,
    backUrl: string | null,
    look: (yaw: number, pitch: number) => void = () => {},
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'default',
    });
    this.resources.add(this.cardGeometry);
    this.resources.add(this.edge);
    try {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobileQuality ? 1.5 : 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.domElement.setAttribute(
        'aria-label',
        'Interactive 3D Durak table. Click cards to select. Drag or use arrow keys to look around; Home recenters. Card controls provide keyboard access.',
      );
      this.renderer.domElement.setAttribute('role', 'img');
      this.renderer.domElement.style.cssText =
        'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
      host.appendChild(this.renderer.domElement);
      this.back = this.makeBack();
      if (backUrl) {
        new THREE.TextureLoader().load(backUrl, (texture) => {
          if (this.disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          this.resources.add(texture);
          this.back.map = texture;
          this.back.needsUpdate = true;
          this.requestFrame();
        });
      }
      this.scene.add(new THREE.HemisphereLight('#e0edf6', '#182b3c', 2.1));
      const key = new THREE.DirectionalLight('#fff0db', 3.5);
      key.position.set(-3, 9, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(this.mobileQuality ? 512 : 1024, this.mobileQuality ? 512 : 1024);
      Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5 });
      key.shadow.bias = -0.001;
      this.scene.add(key);
      this.scene.add(this.labels);
      this.camera.add(this.hand);
      const fill = new THREE.DirectionalLight('#a8d9fa', 1.4);
      fill.position.set(5, 4, -5);
      this.scene.add(fill);
      const [apron, railLayer, trim, feltLayer] = TABLE_LAYERS;
      this.surface(apron, '#38251f', 0.7);
      const rail = this.surface(railLayer, '#ffffff', 0.65);
      rail.material.map = this.texture(
        (ctx) => {
          ctx.fillStyle = '#6a4939';
          ctx.fillRect(0, 0, 1024, 1024);
          for (let n = 0; n < 180; n++) {
            ctx.strokeStyle = n % 3 ? '#d7a57a14' : '#201a1626';
            ctx.lineWidth = (n % 4) + 1;
            ctx.beginPath();
            ctx.moveTo(0, n * 6);
            ctx.bezierCurveTo(300, n * 6 + 20, 650, n * 6 - 30, 1024, n * 6 + 8);
            ctx.stroke();
          }
        },
        1024,
        1024,
      );
      this.surface(trim, '#c69c72', 0.4);
      const felt = this.surface(feltLayer, '#ffffff', 1);
      felt.material.map = this.feltTexture();
      felt.material.needsUpdate = true;
      // Camera-parented hand meshes must be in the scene graph to render.
      this.scene.add(this.camera);
      this.controls = new SeatedView(
        this.camera,
        this.renderer.domElement,
        this.requestFrame,
        look,
        (event) => !(this.canSelect && this.handHit(event)),
      );
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(host);
      this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
      this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
      this.renderer.domElement.addEventListener('pointermove', this.pointerMove);
      this.renderer.domElement.addEventListener('pointerleave', this.pointerLeave);
      this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
      document.addEventListener('visibilitychange', this.visibility);
      this.reducedMotion.addEventListener('change', this.requestFrame);
      this.resize();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private surface(
    { grow, top, depth }: (typeof TABLE_LAYERS)[number],
    color: string,
    roughness: number,
  ) {
    const geometry = new THREE.CylinderGeometry(1, 1, depth, 96);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: roughness < 0.6 ? 0.55 : 0,
    });
    this.resources.add(geometry);
    this.resources.add(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(TABLE_RADIUS_X + grow, 1, TABLE_RADIUS_Z + grow);
    mesh.position.y = top - depth / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * One card shape for every card. Its morph target is the held card: thinner than a table
   * card and bowed toward its face (hands are posed against it), so a card taken up or laid
   * down bends gradually instead of swapping shape.
   */
  private makeCardGeometry() {
    const geometry = this.makeFlatGeometry();
    const held = geometry.clone();
    const positions = held.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(
        i,
        positions.getY(i) * (HELD_CARD.thickness / 0.035) + heldCardBow(positions.getZ(i)),
      );
    held.computeVertexNormals();
    geometry.morphAttributes.position = [held.attributes.position];
    geometry.morphAttributes.normal = [held.attributes.normal];
    held.dispose();
    return geometry;
  }

  private makeFlatGeometry() {
    const geometry = new RoundedBoxGeometry(0.82, 0.035, 1.2, 3, 0.045);
    // Consolidate the four edge faces into one group instead of four draws.
    const groups = [...geometry.groups];
    const original = geometry.index;
    const indices: number[] = [];
    const counts: number[] = [];
    for (const faces of [[0, 1, 4, 5], [2], [3]]) {
      const start = indices.length;
      for (const face of faces) {
        const group = groups[face]!;
        for (let i = group.start; i < group.start + group.count; i++)
          indices.push(original ? original.getX(i) : i);
      }
      counts.push(indices.length - start);
    }
    geometry.setIndex(indices);
    geometry.clearGroups();
    let start = 0;
    counts.forEach((count, material) => {
      geometry.addGroup(start, count, material);
      start += count;
    });
    return geometry;
  }

  private feltTexture() {
    return this.texture(
      (ctx) => {
        ctx.fillStyle = '#244e68';
        ctx.fillRect(0, 0, 1024, 1024);
        // Woven wool: stable fine grain, generated once rather than a remote bitmap.
        for (let y = 0; y < 1024; y += 3) {
          ctx.fillStyle = y % 2 ? '#ffffff06' : '#0000000c';
          ctx.fillRect(0, y, 1024, 1);
        }
        const shade = ctx.createRadialGradient(480, 420, 40, 512, 512, 660);
        shade.addColorStop(0, '#6c99b518');
        shade.addColorStop(1, '#06152166');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.strokeStyle = '#afc7cf32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(512, 512, 474, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#afc7cf12';
        ctx.beginPath();
        ctx.arc(512, 512, 460, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(512, 490);
        ctx.scale(1, -1);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#c7dae031';
        ctx.textAlign = 'center';
        ctx.font = '58px Georgia';
        ctx.fillText('durak', 0, 0);
        ctx.font = '18px Georgia';
        ctx.fillText('♠  ♡  ♣  ♢', 0, 38);
        ctx.restore();
      },
      1024,
      1024,
    );
  }

  private texture(
    draw: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
    width = 256,
    height = 384,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Card textures unavailable');
    draw(context, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.resources.add(texture);
    return texture;
  }

  private makeBack() {
    const map = this.texture((ctx) => {
      ctx.fillStyle = '#243c53';
      ctx.fillRect(0, 0, 256, 384);
      ctx.strokeStyle = '#b5c7d1';
      ctx.lineWidth = 5;
      ctx.strokeRect(13, 13, 230, 358);
      ctx.lineWidth = 1;
      ctx.strokeRect(21, 21, 214, 342);
      ctx.strokeStyle = '#9db6ca38';
      ctx.lineWidth = 1;
      for (let y = -256; y < 384; y += 16) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(236, y + 216);
        ctx.stroke();
      }
      ctx.strokeStyle = '#b5c7d1';
      ctx.save();
      ctx.translate(128, 192);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-65, -65, 130, 130);
      ctx.strokeRect(-52, -52, 104, 104);
      ctx.restore();
      ctx.fillStyle = '#dce6e8';
      ctx.font = '64px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('♠', 128, 214);
    });
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
    this.resources.add(material);
    return material;
  }

  private face(card: TableCard, highResolution = false) {
    const existing = this.faces.get(card.key);
    if (existing) {
      if (
        highResolution &&
        !existing.userData.highResolution &&
        !existing.userData.highResolutionFailed
      )
        this.loadFaceArt(card, existing, true);
      return existing;
    }
    const map = this.texture((ctx) => {
      const background = ctx.createLinearGradient(0, 0, 256, 384);
      background.addColorStop(0, '#fffef6');
      background.addColorStop(1, '#e8e7dd');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 256, 384);
      const red = card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 18;
      const ink = red ? '#a9403d' : '#203245';
      ctx.strokeStyle = '#d3d3c7';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, 244, 372);
      const rank = RANKS[card.rank] ?? String(card.rank);
      const suit = card.isJoker ? '★' : (SUITS[card.suit] ?? '');
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.font = 'bold 48px Georgia';
      ctx.fillText(rank, 43, 60);
      ctx.font = '40px Georgia';
      ctx.fillText(suit, 43, 103);
      ctx.save();
      ctx.translate(256, 384);
      ctx.rotate(Math.PI);
      ctx.font = 'bold 48px Georgia';
      ctx.fillText(rank, 43, 60);
      ctx.font = '40px Georgia';
      ctx.fillText(suit, 43, 103);
      ctx.restore();
      ctx.font = '112px Georgia';
      ctx.fillText(suit, 128, 235);
    });
    const material = new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.62,
      metalness: 0,
      clearcoat: this.mobileQuality ? 0 : 0.18,
      clearcoatRoughness: 0.4,
    });
    this.resources.add(material);
    this.faces.set(card.key, material);
    this.loadFaceArt(card, material, highResolution);
    return material;
  }

  private loadFaceArt(
    card: TableCard,
    material: THREE.MeshStandardMaterial,
    highResolution: boolean,
  ) {
    const artUrl = highResolution ? highResolutionCardFaceUrl(card) : cardFaceUrl(card);
    if (artUrl) {
      material.userData.highResolution = highResolution;
      const loaded = (art: THREE.Texture) => {
        // An earlier low-resolution request must not overwrite an upgraded face.
        if (this.disposed || material.userData.highResolution !== highResolution) {
          art.dispose();
          return;
        }
        art.colorSpace = THREE.SRGBColorSpace;
        art.anisotropy = Math.min(
          this.mobileQuality ? 4 : 16,
          this.renderer.capabilities.getMaxAnisotropy(),
        );
        art.minFilter = THREE.LinearMipmapLinearFilter;
        art.magFilter = THREE.LinearFilter;
        this.resources.add(art);
        // Upload now, between frames, rather than inside the next frame while cards move.
        this.renderer.initTexture?.(art);
        const previous = material.map;
        material.map = art;
        material.needsUpdate = true;
        // Keep the readable generated face only until the local artwork is ready.
        previous?.dispose();
        if (previous) this.resources.delete(previous);
        this.requestFrame();
      };
      const failed = () => {
        if (this.disposed || material.userData.highResolution !== highResolution) return;
        if (highResolution) {
          material.userData.highResolutionFailed = true;
          this.loadFaceArt(card, material, false);
        }
        // If both requests fail, keep the readable generated face.
      };
      if (typeof createImageBitmap === 'function')
        // Decoded off the main thread: an <img> decodes inside the upload, stalling a frame.
        new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }).load(
          artUrl,
          (bitmap) => {
            const art = new THREE.Texture(bitmap);
            art.flipY = false;
            art.needsUpdate = true;
            art.addEventListener('dispose', () => bitmap.close());
            loaded(art);
          },
          undefined,
          failed,
        );
      else new THREE.TextureLoader().load(artUrl, loaded, undefined, failed);
    }
  }

  /**
   * Shows the label `key` with `text`. A label keeps its sprite: only a changed text is
   * redrawn, since replacing every sprite's material also discarded and rebuilt its shader.
   */
  private label(key: string, text: string, x: number, y: number, z: number, active = false) {
    let entry = this.labelSprites.get(key);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 112;
      const context = canvas.getContext('2d');
      if (!context) return;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }),
      );
      this.labels.add(sprite);
      entry = { sprite, context, texture, look: '' };
      this.labelSprites.set(key, entry);
    }
    const look = `${active}:${text}`;
    if (entry.look !== look) {
      const ctx = entry.context;
      ctx.clearRect(0, 0, 512, 112);
      ctx.fillStyle = active ? '#bddce8' : '#172d40';
      ctx.beginPath();
      ctx.roundRect(2, 8, 508, 94, 24);
      ctx.fill();
      ctx.strokeStyle = active ? '#e0eff5' : '#6b879d';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = active ? '#203245' : '#dce6e8';
      ctx.textAlign = 'center';
      ctx.font = '500 40px Segoe UI';
      ctx.fillText(text, 256, 65, 470);
      entry.texture.needsUpdate = true;
      entry.look = look;
    }
    entry.sprite.position.set(x, y, z);
    this.sizeLabel(entry.sprite);
  }

  /** Removes labels not shown in this update, after the others exist, so their shader stays. */
  private dropLabels(shown: ReadonlySet<string>) {
    for (const [key, { sprite, texture }] of this.labelSprites) {
      if (shown.has(key)) continue;
      sprite.removeFromParent();
      sprite.material.dispose();
      texture.dispose();
      this.labelSprites.delete(key);
    }
  }

  private sizeLabel(sprite: THREE.Sprite) {
    const height = this.host.clientHeight;
    if (!height) return;
    const distance = this.camera.position.distanceTo(sprite.position);
    const unitsPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * distance) / height;
    const width = (height < 300 ? 96 : this.host.clientWidth < 600 ? 118 : 156) * unitsPerPixel;
    sprite.scale.set(width, (width * 112) / 512, 1);
  }

  update(snapshot: TableSnapshot, selected: ReadonlySet<string>) {
    const began = performance.now();
    const previous = this.previousSnapshot;
    const events = tableEvents(previous, snapshot);
    // Every selected seat has a place at the table, occupied or not.
    const ringCount = Math.max(
      snapshot.capacity ?? 0,
      snapshot.seats.length + (snapshot.spectator ? 0 : 1),
    );
    this.canSelect = snapshot.canSelect;
    this.controls.setSpectator(Boolean(snapshot.spectator));
    this.hand.visible = !snapshot.spectator;
    const preset = snapshot.self?.preset || 'copper';
    if (preset !== this.ownPreset) {
      this.firstHands?.dispose();
      // Every preset is the same rig, so the eyes are always where the camera expects.
      this.firstHands = new FirstPersonCharacter(preset, () => this.requestFrame(), {
        camera: this.camera,
        cards: this.hand,
        look: () => this.controls.getLook(),
      });
      this.firstHands.table = this.clearance;
      this.scene.add(this.firstHands.root);
      this.controls.setEyeSource?.((yaw, pitch) => this.firstHands?.view(yaw, pitch));
      this.ownPreset = preset;
    }
    if (this.firstHands) {
      this.firstHands.root.visible = !snapshot.spectator;
      // The grip follows the fan as laid out now, which resizing alone does not change.
      this.firstHands.setCardCount(
        snapshot.hand.length,
        fanHalfAngle(snapshot.hand.length, this.camera.aspect),
      );
      this.firstHands.setGesture(snapshot.self || {}, snapshot.serverTimeOffset);
    }
    const shown = new Set<string>();
    const label = (key: string, text: string, x: number, y: number, z: number, active = false) => {
      shown.add(key);
      this.label(key, text, x, y, z, active);
    };
    const live = new Set<string>();
    // Cards first seen in this update; where each comes from is decided below.
    const created = new Set<string>();
    const put = (
      id: string,
      card: TableCard | null,
      x: number,
      y: number,
      z: number,
      angle = 0,
      handKey?: string,
      tilt = 0.12,
      roll = 0,
      parentOverride?: THREE.Object3D,
    ) => {
      const visualId = card ? `card:${card.key}` : id;
      live.add(visualId);
      // Held cards take the upright tilt first, then fan around the holder's forward axis.
      const held = Boolean(handKey || parentOverride);
      const home: Home = {
        parent: parentOverride ?? (handKey ? this.hand : this.scene),
        position: new THREE.Vector3(x, y, z),
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(tilt, angle, roll, held ? 'ZYX' : 'XYZ'),
        ),
        scale: held ? HELD_CARD_SCALE : TABLE_CARD_SCALE,
        bend: held ? 1 : 0,
      };
      let item = this.cards.get(visualId);
      if (!item) {
        const material = card ? this.face(card, id.startsWith('huzur:')) : this.back;
        const mesh = new THREE.Mesh(
          this.cardGeometry,
          card ? [this.edge, material, this.back] : this.back,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        applyPose(mesh, home);
        home.parent.add(mesh);
        item = { mesh, home, aim: home };
        this.cards.set(visualId, item);
        created.add(visualId);
      }
      if (card) {
        item.mesh.material = [this.edge, this.face(card, id.startsWith('huzur:')), this.back];
        item.mesh.userData.cardKey = card.key;
        item.mesh.userData.zone = id.split(':')[0];
      }
      // A card on its way out that is shown again stays: it simply heads for its new place,
      // and the fan slot it was going to fill is shown now.
      item.removing = false;
      item.follow = undefined;
      if (item.reveal) item.reveal.visible = true;
      item.reveal = undefined;
      item.mesh.userData.handKey = handKey;
      item.home = home;
    };
    for (let i = 0; i < Math.min(12, snapshot.deckCount); i++) {
      put(
        `deck:${i}`,
        null,
        LAYOUT.deck.x,
        TABLE_TOP + cm(0.3) + i * cm(0.25),
        LAYOUT.deck.z,
        0,
        undefined,
        0,
      );
    }
    if (snapshot.deckCount > 0)
      // The felt top is y=0.075. Keep the entire card above it, including its corners.
      put(
        `huzur:${snapshot.huzur.key}`,
        snapshot.huzur,
        LAYOUT.trump.x,
        TABLE_TOP + cm(0.3),
        LAYOUT.trump.z,
        -0.12,
        undefined,
        0,
      );
    // The DOM caption already supplies the deck count at every camera angle.
    if (snapshot.discardCount > 0) {
      for (let i = 0; i < 3; i++)
        put(
          `discard:${i}`,
          null,
          LAYOUT.discard.x + i * cm(0.3),
          TABLE_TOP + cm(0.3) + i * cm(0.3),
          LAYOUT.discard.z,
          -0.12,
          undefined,
          0,
        );
      label(
        'discard',
        `${snapshot.discardCount} discarded`,
        LAYOUT.discard.x,
        TABLE_TOP + cm(12),
        LAYOUT.discard.z + cm(12),
      );
    }
    snapshot.history.slice(-14).forEach((card, i, history) => {
      const pair = Math.floor(i / 2);
      put(
        `history:${card.key}`,
        card,
        (pair - (Math.ceil(history.length / 2) - 1) / 2) * LAYOUT.spacing + (i % 2) * cm(1.8),
        TABLE_TOP + cm(0.3) + (i % 2) * cm(0.3),
        LAYOUT.historyZ + (i % 2) * cm(3),
        (i % 2) * -0.12,
        undefined,
        0,
      );
    });
    snapshot.attacks.forEach((card, i) =>
      put(
        `attack:${card.key}`,
        card,
        (i - (snapshot.attacks.length - 1) / 2) * LAYOUT.spacing,
        TABLE_TOP + cm(0.3),
        LAYOUT.attackZ,
        0,
        undefined,
        0,
      ),
    );
    const handStep = fanStep(snapshot.hand.length, this.camera.aspect);
    snapshot.hand.forEach((card, i) => {
      const { angle, position } = heldCard(
        i,
        snapshot.hand.length,
        handStep,
        selected.has(card.key),
      );
      put(
        `hand:${card.key}`,
        card,
        position.x,
        position.y,
        position.z,
        0,
        card.key,
        Math.PI / 2,
        -angle,
      );
    });
    const present = new Set(snapshot.seats.map((s) => s.id));
    for (const [id, rig] of this.avatars) {
      if (!present.has(id)) {
        rig.dispose();
        this.avatars.delete(id);
      }
    }
    snapshot.seats.forEach((seat, i) => {
      const count = ringCount;
      const angle = ((i + (snapshot.spectator ? 0 : 1)) * Math.PI * 2) / Math.max(1, count);
      const x = Math.sin(angle) * SEAT_RADIUS_X;
      const z = Math.cos(angle) * SEAT_RADIUS_Z;
      const facing = angle + Math.PI;
      let rig = this.avatars.get(seat.id);
      const preset = seat.preset || 'copper';
      if (rig && rig.presetId !== preset) {
        rig.dispose();
        this.avatars.delete(seat.id);
        rig = undefined;
      }
      if (!rig) {
        rig = new SeatedCharacter(preset, () => this.requestFrame());
        rig.table = this.clearance;
        this.avatars.set(seat.id, rig);
        this.scene.add(rig.root);
      }
      rig.root.scale.setScalar(SEATED_PLAYER_SCALE);
      rig.root.position.set(x, CHARACTER_FLOOR, z);
      rig.root.rotation.y = facing;
      let yaw = seat.yaw || 0;
      if (seat.bot) {
        const active = snapshot.seats.findIndex((s) => s.active);
        const targetAngle =
          active < 0
            ? 0
            : ((active + (snapshot.spectator ? 0 : 1)) * Math.PI * 2) / Math.max(1, count);
        const target = new THREE.Vector3(
          Math.sin(targetAngle) * SEAT_RADIUS_X - x,
          0,
          Math.cos(targetAngle) * SEAT_RADIUS_Z - z,
        );
        yaw = THREE.MathUtils.clamp(
          THREE.MathUtils.euclideanModulo(
            Math.atan2(target.x, target.z) - facing + Math.PI,
            Math.PI * 2,
          ) - Math.PI,
          -0.65,
          0.65,
        );
      }
      rig.update(yaw, seat.pitch || 0);
      rig.setGesture(seat, snapshot.serverTimeOffset, seat.count);
      const fanCount = Math.min(7, seat.count);
      for (let n = 0; n < fanCount; n++) {
        const { angle, position } = heldCard(n, fanCount, fanStep(fanCount));
        put(
          `seat:${seat.id}:${n}`,
          null,
          position.x,
          position.y,
          position.z,
          0,
          undefined,
          Math.PI / 2,
          -angle,
          rig.fan,
        );
      }
      label(
        `seat:${seat.id}`,
        `${snapshot.teamMode ? (seat.team === 0 ? '◆ Blue · ' : '● Red · ') : ''}${seat.name.slice(0, 20)} · ${seatStatus(seat, snapshot.betweenGames)}`,
        x,
        labelHeight(preset),
        z,
        seat.active,
      );
    });
    // Unoccupied seats follow the occupied ones clockwise.
    const offset = snapshot.spectator ? 0 : 1;
    for (let i = snapshot.seats.length + offset; i < ringCount; i++) {
      const angle = (i * Math.PI * 2) / ringCount;
      label(
        `empty:${i}`,
        'Empty seat',
        Math.sin(angle) * SEAT_RADIUS_X,
        CHARACTER_FLOOR + cm(110),
        Math.cos(angle) * SEAT_RADIUS_Z,
      );
    }
    this.dropLabels(shown);
    // Hands meet the deck and the discard pile as they lie now.
    this.piles = [
      ...(snapshot.deckCount > 0
        ? [
            {
              x: LAYOUT.deck.x,
              z: LAYOUT.deck.z,
              halfX: CARD_HALF.x,
              halfZ: CARD_HALF.z,
              top: deckTop(snapshot.deckCount),
            },
          ]
        : []),
      // Three cards, each a little askew.
      ...(snapshot.discardCount > 0
        ? [
            {
              x: LAYOUT.discard.x + cm(0.3),
              z: LAYOUT.discard.z,
              halfX: CARD_HALF.x + cm(1),
              halfZ: CARD_HALF.z + cm(1),
              top: TABLE_TOP + cm(0.9) + CARD_HALF.y,
            },
          ]
        : []),
    ];
    const now = performance.now();
    const animate = Boolean(previous) && !this.reducedMotion.matches;
    if (previous && animate)
      this.choreograph(events, previous, snapshot, created, this.actOut(events, now), now);
    else if (!this.reducedMotion.matches) this.actOut(events, now);
    let swept = 0;
    for (const [id, card] of this.cards) {
      if (live.has(id) || card.removing) continue;
      const key = card.mesh.userData.cardKey;
      // Older pairs outside the visible history window stay on the table; retire quietly. A
      // card with no public destination (a round reset) goes without inventing one.
      const discarded =
        animate &&
        key &&
        !snapshot.history.some((c) => c.key === key) &&
        snapshot.discardCount > (previous?.discardCount ?? 0);
      if (!discarded) {
        card.mesh.removeFromParent();
        this.cards.delete(id);
        continue;
      }
      // Swept onto the discard pile one after another, landing as the pile's top card.
      card.removing = true;
      card.home = {
        parent: this.scene,
        position: new THREE.Vector3(LAYOUT.discard.x, TABLE_TOP + cm(1.2), LAYOUT.discard.z),
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.12, 0)),
        scale: TABLE_CARD_SCALE,
        bend: 0,
      };
      // A card still in a hand (the last defence, as the round ends) is let go first, and
      // goes on from there: holding it back froze it in the air while the hand moved on.
      if (!card.carry) card.wait = { until: now + swept++ * 45 };
    }
    if (import.meta.env.DEV)
      (window as { __durakTrace?: unknown[] }).__durakTrace?.push({
        u: began,
        cost: performance.now() - began,
        events,
      });
    this.previousSnapshot = snapshot;
    this.requestFrame();
  }

  /**
   * Characters reach for the table, gather a pile or draw, as the public game moves. Returns
   * each actor's acting hand and when its card action starts.
   */
  private actOut(events: TableEvent[], now: number) {
    const body = (seat: string) => (seat === SELF ? this.firstHands : this.avatars.get(seat));
    const acts = new Map<string, { side: 'L' | 'R'; start: number }>();
    for (const event of events) {
      if (event.kind === 'gameOver') {
        // Seen on the other players; the local view keeps its eyes on the table.
        if (event.loser && event.loser !== SELF) this.avatars.get(event.loser)?.react('cry');
        for (const winner of event.winners)
          if (winner !== SELF) this.avatars.get(winner)?.react('victory');
        continue;
      }
      const actor = body(event.seat);
      if (!actor) continue;
      let side: 'L' | 'R' | undefined;
      let start = now;
      if (event.kind === 'play') {
        const slot = this.cards.get(`card:${event.cards[0]}`)?.home.position;
        if (slot) side = actor.act('play', { table: slot.clone() }, now);
      } else if (event.kind === 'pickup')
        side = actor.act('pickup', { table: TABLE_CENTRE.clone() }, now);
      else {
        // A refill that arrives with a play is reached for once the card is down.
        if (acts.get(event.seat)) start += ACTIONS.play.R.duration - 150;
        side = actor.act('draw', { deck: DECK_TOP.clone() }, start);
      }
      if (side) acts.set(event.seat, { side, start });
    }
    return acts;
  }

  /**
   * Where cards arriving in this update come from, timed with the hands that move them:
   * a played card leaves its player's fan in the free hand and is let go over its place; a
   * pile waits on the table for the hand that gathers it; drawn cards leave the deck one by
   * one, in turn around the table.
   */
  private choreograph(
    events: TableEvent[],
    previous: TableSnapshot,
    snapshot: TableSnapshot,
    created: ReadonlySet<string>,
    acts: Map<string, { side: 'L' | 'R'; start: number }>,
    now: number,
  ) {
    const body = (seat: string) => (seat === SELF ? this.firstHands : this.avatars.get(seat));
    // Played and gathered cards are held face up; drawn cards as they come off the deck.
    const grip = (seat: string, faceIn: boolean) => {
      const actor = body(seat);
      const act = acts.get(seat);
      return actor && act ? () => actor.held(act.side, CARD_HALF.z, faceIn) : undefined;
    };
    const held = (seat: string) => previous.seats.find((s) => s.id === seat)?.count ?? 0;
    // The fan slots each peer gained, hidden until the card filling each one arrives.
    const opened = new Map<string, AnimatedCard[]>();
    const deliver = (seat: string, id: string, courier: AnimatedCard) => {
      const slots = Array.from({ length: 7 }, (_, n) => this.cards.get(`seat:${seat}:${n}`));
      if (!opened.has(seat))
        opened.set(
          seat,
          slots.filter((slot, n) => slot && created.has(`seat:${seat}:${n}`)) as AnimatedCard[],
        );
      const fresh = opened.get(seat)!.shift();
      // Past the seven cards a fan shows, a card joins the outermost one.
      const slot = fresh ?? slots.filter(Boolean).at(-1);
      if (!slot || !this.avatars.get(seat)?.fan.visible) {
        courier.mesh.removeFromParent();
        this.cards.delete(id);
        return false;
      }
      courier.removing = true;
      courier.follow = slot;
      if (fresh) {
        fresh.mesh.visible = false;
        courier.reveal = fresh.mesh;
      }
      return true;
    };
    for (const event of events) {
      if (event.kind === 'play') {
        const carry = grip(event.seat, true);
        for (const key of event.cards) {
          const item = this.cards.get(`card:${key}`);
          if (!item) continue;
          // A peer's new card appears where their outermost held card was.
          const source =
            event.seat !== SELF && created.has(`card:${key}`)
              ? this.cards.get(`seat:${event.seat}:${Math.min(7, held(event.seat)) - 1}`)
              : undefined;
          if (source?.mesh.visible && source.mesh.parent?.visible !== false) {
            applyPose(item.mesh, toWorld(meshPose(source.mesh), source.mesh.parent!));
            item.aim = undefined;
          }
          if (carry)
            item.carry = {
              grip: carry,
              from: now,
              reach: 240,
              release: now + PLAY_RELEASE_MS,
            };
        }
      } else if (event.kind === 'pickup') {
        const carry = grip(event.seat, true);
        event.cards.forEach((key, j) => {
          const id = `card:${key}`;
          const item = this.cards.get(id);
          if (!item || (event.seat !== SELF && !deliver(event.seat, id, item))) return;
          if (carry)
            item.carry = {
              grip: carry,
              from: now + PICKUP_TAKE_MS + j * 35,
              reach: 300,
              release: now + PICKUP_DRAWN_IN_MS,
            };
        });
      }
    }
    // Each drawing hand takes its cards off the deck together, draws them back under its fan
    // and lets them into the fan one at a time.
    const draws = events.filter((event) => event.kind === 'draw');
    const taken = new Set([
      ...previous.hand.map((card) => card.key),
      ...events.flatMap((event) => (event.kind === 'pickup' ? event.cards : [])),
    ]);
    const mine = snapshot.hand
      .filter((card) => !taken.has(card.key))
      .map((card) => this.cards.get(`card:${card.key}`)!);
    // When the last card is drawn, the face-up Huzur goes into a peer's hand (unless ours).
    const huzurId = `card:${previous.huzur.key}`;
    const huzur =
      previous.deckCount > 0 &&
      snapshot.deckCount === 0 &&
      !snapshot.hand.some((card) => card.key === previous.huzur.key)
        ? this.cards.get(huzurId)
        : undefined;
    // The last card drawn is the Huzur; a peer drawing last takes it.
    const lastPeer = draws.findLast((event) => event.seat !== SELF);
    for (const event of draws) {
      const start = acts.get(event.seat)?.start ?? now;
      const carry = grip(event.seat, false);
      const gap = Math.min(110, 360 / event.count);
      for (let i = 0; i < event.count; i++) {
        // The drawn cards lie on top of the deck, one on another, until slid off it.
        const top: CardPose = {
          ...clonePose(DECK_POSE),
          position: DECK_TOP.clone().setY(deckTop(previous.deckCount) + CARD_HALF.y + i * cm(0.25)),
        };
        let id: string;
        let item: AnimatedCard | undefined;
        if (event.seat === SELF) {
          item = mine[i];
          if (!item) continue;
          id = `card:${item.mesh.userData.cardKey}`;
        } else if (huzur && event === lastPeer && i === event.count - 1) {
          [id, item] = [huzurId, huzur];
        } else {
          const mesh = new THREE.Mesh(this.cardGeometry, this.back);
          mesh.castShadow = true;
          id = `deal:${this.dealt++}`;
          item = { mesh, home: { ...clonePose(top), parent: this.scene } };
          this.scene.add(mesh);
          this.cards.set(id, item);
        }
        // A card new to the table appears on the deck as it is slid off toward the hand; the
        // Huzur is taken from its own place.
        const fresh = id.startsWith('deal:') || created.has(id);
        if (fresh) {
          this.scene.add(item.mesh);
          applyPose(item.mesh, top);
          item.mesh.visible = false;
          item.aim = undefined;
        }
        if (event.seat !== SELF && !deliver(event.seat, id, item)) continue;
        if (carry) {
          item.wait = { until: start + DRAW_SLIDE_MS, ...(fresh ? { from: top } : {}) };
          item.carry = {
            grip: carry,
            from: start + DRAW_SLIDE_MS,
            reach: DRAW_TAKE_MS - DRAW_SLIDE_MS,
            release: start + DRAW_BACK_MS + i * gap,
            slide: true,
          };
        } else
          item.wait = {
            until: start + DRAW_TAKE_MS + i * gap,
            ...(fresh ? { from: top } : {}),
          };
      }
    }
  }

  recenter() {
    this.controls.recenter();
  }

  private resize = () => {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    const mobile = width < 760 || window.matchMedia('(pointer: coarse)').matches;
    this.mobileQuality = mobile;
    this.compact = width < 760;
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.faces.forEach((material) => {
      if (material instanceof THREE.MeshPhysicalMaterial) {
        material.clearcoat = mobile ? 0 : 0.18;
        material.needsUpdate = true;
      }
      if (material.map) {
        material.map.anisotropy = Math.min(
          mobile ? 4 : 16,
          this.renderer.capabilities.getMaxAnisotropy(),
        );
        material.map.needsUpdate = true;
      }
    });
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = 80;
    this.camera.updateProjectionMatrix();
    // Fit the complete fan without distorting the proportions of each card.
    const depth = CARRY_DEPTH;
    const scale = CARRY_SCALE;
    this.hand.scale.setScalar(scale);
    this.hand.position.set(0, CARRY_Y, -depth);
    this.hand.rotation.x = CARRY_TILT;
    this.labels.children.forEach((label) => this.sizeLabel(label as THREE.Sprite));
    this.requestFrame();
  };

  private pointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };
  private pointerMove = (event: PointerEvent) => {
    if (event.buttons || event.pointerType === 'touch') return;
    const hit = this.handHit(event);
    const key = hit?.object.userData.handKey as string | undefined;
    if (this.hoverKey !== (key || null)) {
      this.hoverKey = key || null;
      this.renderer.domElement.style.cursor = key && this.canSelect ? 'pointer' : 'grab';
      this.requestFrame();
    }
  };
  private pointerLeave = () => {
    this.hoverKey = null;
    this.requestFrame();
  };
  private handHit(event: PointerEvent) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.raycaster.intersectObjects(
      Array.from(this.cards.values())
        .filter((c) => !c.removing && c.mesh.visible && c.mesh.userData.handKey)
        .map((c) => c.mesh),
      false,
    )[0];
  }
  private pointerUp = (event: PointerEvent) => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (
      !this.canSelect ||
      !start ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
    )
      return;
    const hit = this.handHit(event);
    if (hit) this.select(hit.object.userData.handKey as string);
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.failed();
  };
  private visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      clearTimeout(this.idleTimer);
      this.frame = 0;
    } else this.requestFrame();
  };
  private requestFrame = () => {
    clearTimeout(this.idleTimer);
    if (!this.disposed && !document.hidden && !this.frame)
      this.frame = requestAnimationFrame(this.render);
  };
  private render = () => {
    this.frame = 0;
    if (this.disposed) return;
    const now = performance.now();
    // Narrow tables draw every other display frame: skipping whole frames keeps the pace even.
    if (this.compact && now - this.lastRender < 28) {
      this.frame = requestAnimationFrame(this.render);
      return;
    }
    this.lastRender = now;
    let moving = false;
    for (const rig of this.avatars.values())
      moving = rig.animate(now / 1000, this.reducedMotion.matches) || moving;
    if (this.firstHands && this.hand.visible) {
      // The local fan is drawn up out of the way while the free hand reaches across.
      this.hand.position.set(
        0,
        CARRY_Y + CARRY_RAISE * this.firstHands.cardsRaised(),
        -CARRY_DEPTH,
      );
      moving = this.firstHands.animate(now / 1000, this.reducedMotion.matches) || moving;
    }
    // Hands are posed for this frame first, so a carried card is drawn in the palm it is in.
    for (const [id, card] of this.cards)
      moving = this.step(id, card, now, this.reducedMotion.matches) || moving;
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) {
      this.host.dataset.renderCalls = String(this.renderer.info.render.calls);
      this.host.dataset.geometries = String(this.renderer.info.memory.geometries);
      this.host.dataset.textures = String(this.renderer.info.memory.textures);
      this.host.dataset.avatarCount = String(this.avatars.size);
      // Frames drawn so far; the dev panel turns this into frames per second.
      this.host.dataset.frames = String(Number(this.host.dataset.frames ?? 0) + 1);
      this.trace(now, performance.now() - now);
    }
    // While anything moves, draw every display frame: a timer between frames lands on
    // alternate frames unevenly, which reads as stutter.
    if (moving) this.frame = requestAnimationFrame(this.render);
    // Seated players keep breathing: slow, small motion that reads smoothly at 20 fps.
    else if (this.avatars.size > 0 && !this.reducedMotion.matches)
      this.idleTimer = setTimeout(this.requestFrame, this.mobileQuality ? 125 : 50);
  };

  /** Where a card should be now: its home, raised while the pointer is over it in the hand. */
  private homeOf(card: AnimatedCard): Home {
    const home = card.follow?.home ?? card.home;
    const hovered =
      this.canSelect &&
      !card.removing &&
      card.mesh.userData.handKey &&
      card.mesh.userData.handKey === this.hoverKey;
    return hovered
      ? { ...home, position: home.position.clone().setY(home.position.y + 0.22) }
      : home;
  }

  /** Moves one card to where it is at `now`; returns whether it is still on its way. */
  private step(id: string, card: AnimatedCard, now: number, reduced: boolean) {
    const home = this.homeOf(card);
    if (reduced) {
      card.wait = card.carry = undefined;
      card.mesh.visible = true;
      this.settle(id, card, home);
      return false;
    }
    if (card.wait) {
      if (now < card.wait.until) return true;
      if (card.wait.from) {
        this.scene.add(card.mesh);
        applyPose(card.mesh, card.wait.from);
        card.last = undefined;
      }
      card.mesh.visible = true;
      card.wait = undefined;
      card.aim = undefined;
    }
    if (card.carry) {
      const carry = card.carry;
      if (!carry.anchor) {
        // Taken where it lies (or from the fan): world space from here, the hand moves it.
        if (card.mesh.parent !== this.scene) this.scene.attach(card.mesh);
        carry.anchor = meshPose(card.mesh);
        card.last = undefined;
      }
      const grip = now < carry.release ? carry.grip() : undefined;
      if (grip) {
        // Into the fingers: flat, card-sized and as the hand holds it.
        const join = THREE.MathUtils.smoothstep(now, carry.from, carry.from + carry.reach);
        const position = carry.anchor.position.clone().lerp(grip.position, join);
        if (carry.slide)
          // Down onto the felt, across it, and up into the hand only at the end.
          position.y = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(
              carry.anchor.position.y,
              TABLE_TOP + cm(0.4),
              THREE.MathUtils.smoothstep(join, 0, 0.2),
            ),
            grip.position.y,
            THREE.MathUtils.smoothstep(join, 0.7, 1),
          );
        applyPose(card.mesh, {
          position,
          quaternion: carry.anchor.quaternion.clone().slerp(grip.quaternion, join),
          scale: THREE.MathUtils.lerp(carry.anchor.scale, TABLE_CARD_SCALE, join),
          bend: THREE.MathUtils.lerp(carry.anchor.bend, 0, join),
        });
        this.track(card, now, this.scene);
        return true;
      }
      // Let go: it travels on from here at the speed the hand gave it.
      card.carry = undefined;
      card.aim = undefined;
    }
    if (!card.aim || card.aim.parent !== home.parent || !samePose(card.aim, home))
      this.setOff(card, home, now);
    const flight = card.flight;
    if (!flight) return false;
    const s = Math.min(1, (now - flight.start) / flight.duration);
    if (s >= 1) {
      this.settle(id, card, home);
      return false;
    }
    const to = flight.world ? toWorld(home, home.parent) : home;
    const eased = ease(Math.max(0, s));
    applyPose(card.mesh, {
      position: flightPoint(
        flight.from.position,
        flight.velocity,
        to.position,
        flight.duration,
        Math.max(0, s),
        flight.lift,
      ),
      quaternion: flight.from.quaternion.clone().slerp(to.quaternion, eased),
      scale: THREE.MathUtils.lerp(flight.from.scale, to.scale, eased),
      bend: THREE.MathUtils.lerp(flight.from.bend, to.bend, eased),
    });
    this.track(card, now, flight.world ? this.scene : home.parent);
    return true;
  }

  /**
   * Sets a card off toward `home` from wherever it is, at the speed it already has. Within
   * its home's frame it keeps to that frame (a fan reflowing as the view turns); between
   * frames it travels in world space, so neither frame's own motion drags it about.
   */
  private setOff(card: AnimatedCard, home: Home, now: number) {
    const world = card.mesh.parent !== home.parent;
    if (world && card.mesh.parent !== this.scene) this.scene.attach(card.mesh);
    const frame = world ? this.scene : home.parent;
    const from = meshPose(card.mesh);
    const to = world ? toWorld(home, home.parent) : home;
    const last = card.last;
    const moving = last && now - last.time < 100;
    const velocity = moving
      ? last.frame === frame
        ? last.velocity.clone()
        : directionToWorld(directionToWorld(last.velocity, last.frame), frame, true)
      : new THREE.Vector3();
    const distance =
      from.position.distanceTo(to.position) *
      (world ? 1 : frame.getWorldScale(new THREE.Vector3()).x);
    card.flight = {
      // A moving card's new way starts where it was last drawn, so this frame already moves
      // on along it instead of drawing the same place twice.
      start: moving ? last.time : now,
      duration: travelTime(distance),
      from,
      velocity,
      world,
      // Over the table a card lifts a little, clear of the cards it passes.
      lift: home.parent === this.scene ? Math.min(cm(3), distance * 0.1) : 0,
    };
    card.aim = { ...clonePose(home), parent: home.parent };
  }

  /** Puts a card exactly at home, in its home's frame; a card on its way out goes now. */
  private settle(id: string, card: AnimatedCard, home: Home) {
    card.flight = undefined;
    card.last = undefined;
    if (card.removing) {
      card.mesh.removeFromParent();
      this.cards.delete(id);
      if (card.reveal) card.reveal.visible = true;
      return;
    }
    if (card.mesh.parent !== home.parent) home.parent.add(card.mesh);
    applyPose(card.mesh, home);
    card.aim = { ...clonePose(home), parent: home.parent };
  }

  /** Remembers where a card was drawn, and how fast it was moving, in `frame`. */
  private track(card: AnimatedCard, now: number, frame: THREE.Object3D) {
    const last = card.last;
    const position = card.mesh.position.clone();
    const dt = last ? now - last.time : 0;
    card.last = {
      position,
      time: now,
      frame,
      velocity:
        last && last.frame === frame && dt > 0
          ? position.clone().sub(last.position).divideScalar(dt)
          : new THREE.Vector3(),
    };
  }

  /**
   * Dev builds: while `window.__durakTrace` is an array, every drawn frame appends its time
   * and each card's world position, size and parent, to tell a jump from an uneven frame.
   */
  private trace(now: number, cost: number) {
    const log = (window as { __durakTrace?: unknown[] }).__durakTrace;
    if (!Array.isArray(log)) return;
    const at = new THREE.Vector3();
    const size = new THREE.Vector3();
    log.push({
      t: now,
      cost,
      cards: [...this.cards].map(([id, card]) => {
        const { mesh } = card;
        mesh.updateWorldMatrix(true, false);
        mesh.matrixWorld.decompose(at, new THREE.Quaternion(), size);
        const parent = mesh.parent === this.scene ? 's' : mesh.parent === this.hand ? 'h' : 'f';
        // What moves it: waiting, carried in a hand, flying home, or at rest.
        const phase = card.wait ? 'w' : card.carry ? 'c' : card.flight ? 'f' : '-';
        return [
          id,
          +at.x.toFixed(4),
          +at.y.toFixed(4),
          +at.z.toFixed(4),
          +size.x.toFixed(4),
          parent,
          mesh.visible ? 1 : 0,
          phase,
        ];
      }),
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.idleTimer);
    this.observer?.disconnect();
    this.controls?.dispose();
    this.avatars.forEach((rig) => rig.dispose());
    this.avatars.clear();
    this.firstHands?.dispose();
    document.removeEventListener('visibilitychange', this.visibility);
    this.reducedMotion.removeEventListener('change', this.requestFrame);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointerup', this.pointerUp);
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerleave', this.pointerLeave);
    canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.labels.children.forEach((object) => (object as THREE.Sprite).material.dispose());
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) object.dispose();
    });
    this.resources.forEach((resource) => resource.dispose());
    const contextWasLost = this.renderer.getContext().isContextLost();
    this.renderer.dispose();
    if (!contextWasLost) this.renderer.forceContextLoss();
    canvas.remove();
    this.cards.clear();
    this.faces.clear();
    this.resources.clear();
  }
}
