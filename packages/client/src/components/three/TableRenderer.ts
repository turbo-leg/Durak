import * as THREE from 'three';
import { SeatedView } from './SeatedView';
import { AvatarRig } from './AvatarRig';
import { CasualAvatar, makeCasualHands } from './CasualAvatar';
import { makeFirstPersonHands } from './FirstPersonHands';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seatStatus, type TableCard, type TableSnapshot } from '../../game/tableSnapshot';
import { cardFaceUrl, highResolutionCardFaceUrl } from '../../game/cardArt';
import {
  CHARACTER_SCALE,
  CARD_HOLD_HEIGHT,
  CHARACTER_FLOOR,
  CARRY_DEPTH,
  CARRY_SCALE,
  CARRY_TILT,
  CARRY_Y,
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
const HELD_CARD_SCALE = 0.8;
const SUITS: Record<string, string> = { Spades: '♠', Hearts: '♥', Diamonds: '♦', Clubs: '♣' };
// Grow seated players around the held-card height, keeping their grip at the table.
const SEATED_PLAYER_SCALE = CHARACTER_SCALE;
const SEATED_CARD_HEIGHT = CARD_HOLD_HEIGHT;
type AnimatedCard = {
  mesh: THREE.Mesh;
  target: THREE.Vector3;
  angle: number;
  roll: number;
  tilt: number;
  removing?: boolean;
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
  private heldGeometry = this.makeHeldGeometry();
  private faces = new Map<string, THREE.MeshStandardMaterial>();
  private edge = new THREE.MeshStandardMaterial({ color: '#d7d6cc', roughness: 0.8 });
  private controls: SeatedView;
  private avatars = new Map<string, AvatarRig | CasualAvatar>();
  private firstHands:
    | ReturnType<typeof makeFirstPersonHands>
    | ReturnType<typeof makeCasualHands>
    | undefined;
  private ownPreset = '';
  private lastPlayed: number | undefined;
  private playStarted = -Infinity;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private labelSignature = '';
  private hoverKey: string | null = null;
  private targetPosition = new THREE.Vector3();
  private back: THREE.MeshStandardMaterial;
  private raycaster = new THREE.Raycaster();
  private observer: ResizeObserver;
  private frame = 0;
  private lastRender = 0;
  private disposed = false;
  private mobileQuality = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
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
    this.resources.add(this.heldGeometry);
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
      Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7 });
      key.shadow.bias = -0.001;
      this.scene.add(key);
      this.scene.add(this.labels);
      this.camera.add(this.hand);
      const fill = new THREE.DirectionalLight('#a8d9fa', 1.4);
      fill.position.set(5, 4, -5);
      this.scene.add(fill);
      this.surface(6.0, 3.7, -0.3, 0.44, '#38251f', 0.7);
      const rail = this.surface(5.96, 3.66, -0.06, 0.12, '#ffffff', 0.65);
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
      this.surface(5.61, 3.31, 0.005, 0.06, '#c69c72', 0.4);
      const felt = this.surface(5.56, 3.26, 0.045, 0.06, '#ffffff', 1);
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
    x: number,
    z: number,
    y: number,
    depth: number,
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
    mesh.scale.set(x, 1, z);
    mesh.position.y = y;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private makeHeldGeometry() {
    const geometry = this.cardGeometry.clone();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const along = positions.getZ(i) / 0.6;
      positions.setY(i, positions.getY(i) * 0.35 + 0.025 * along * along);
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private makeCardGeometry() {
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
      new THREE.TextureLoader().load(
        artUrl,
        (art) => {
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
          const previous = material.map;
          material.map = art;
          material.needsUpdate = true;
          // Keep the readable generated face only until the local artwork is ready.
          previous?.dispose();
          if (previous) this.resources.delete(previous);
          this.requestFrame();
        },
        undefined,
        () => {
          if (this.disposed || material.userData.highResolution !== highResolution) return;
          if (highResolution) {
            material.userData.highResolutionFailed = true;
            this.loadFaceArt(card, material, false);
          }
          // If both requests fail, keep the readable generated face.
        },
      );
    }
  }

  private label(text: string, x: number, y: number, z: number, active = false) {
    const texture = this.texture(
      (ctx) => {
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
      },
      512,
      112,
    );
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.15, 0.47, 1);
    sprite.position.set(x, y, z);
    sprite.userData.texture = texture;
    this.labels.add(sprite);
    this.sizeLabel(sprite);
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
    const previous = this.previousSnapshot;
    // Every selected seat has a place at the table, occupied or not.
    const ringCount = Math.max(
      snapshot.capacity ?? 0,
      snapshot.seats.length + (snapshot.spectator ? 0 : 1),
    );
    const seatPosition = (id: string) => {
      const index = snapshot.seats.findIndex((seat) => seat.id === id);
      const count = ringCount;
      const angle = ((index + (snapshot.spectator ? 0 : 1)) * Math.PI * 2) / Math.max(1, count);
      return new THREE.Vector3(Math.sin(angle) * 6.6, 0.4, Math.cos(angle) * 4.65);
    };
    this.canSelect = snapshot.canSelect;
    this.controls.setSpectator(Boolean(snapshot.spectator));
    this.hand.visible = !snapshot.spectator;
    const preset = snapshot.self?.preset || 'copper';
    this.controls.setPreset?.(preset);
    if (preset !== this.ownPreset) {
      this.firstHands?.dispose();
      this.firstHands =
        preset === 'casual'
          ? makeCasualHands(() => this.requestFrame(), {
              camera: this.camera,
              cards: this.hand,
              look: () => this.controls.getLook(),
            })
          : makeFirstPersonHands(preset, () => this.requestFrame());
      (preset === 'casual' ? this.scene : this.hand).add(this.firstHands.root);
      this.controls.setEyeSource?.(
        preset === 'casual'
          ? (yaw, pitch) =>
              this.firstHands && 'view' in this.firstHands
                ? this.firstHands.view(yaw, pitch)
                : undefined
          : undefined,
      );
      this.ownPreset = preset;
    }
    const played = snapshot.self?.played || 0;
    if (this.firstHands) {
      this.firstHands.root.visible =
        !snapshot.spectator && (snapshot.hand.length > 0 || Boolean(snapshot.self?.gestureId));
      this.firstHands.setCardCount(snapshot.hand.length, HELD_CARD_SCALE);
      if ('setGesture' in this.firstHands)
        this.firstHands.setGesture(snapshot.self || {}, snapshot.serverTimeOffset);
    }
    if (this.lastPlayed !== undefined && played !== this.lastPlayed)
      this.playStarted = performance.now();
    this.lastPlayed = played;
    const labels = JSON.stringify([
      snapshot.deckCount,
      snapshot.discardCount,
      snapshot.seats.map((s) => [
        s.id,
        s.name,
        s.count,
        s.active,
        s.escaped,
        s.team,
        s.ready,
        s.connected,
        s.standin,
      ]),
      snapshot.spectator,
      snapshot.teamMode,
      snapshot.betweenGames,
      ringCount,
    ]);
    const refreshLabels = this.labelSignature !== labels;
    this.labelSignature = labels;
    // Labels are small, public-only textures. Release them immediately on update.
    if (refreshLabels)
      this.labels.children.forEach((object) => {
        const sprite = object as THREE.Sprite;
        const texture = sprite.userData.texture as THREE.Texture;
        texture.dispose();
        this.resources.delete(texture);
        sprite.material.dispose();
      });
    if (refreshLabels) this.labels.clear();
    const live = new Set<string>();
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
      let item = this.cards.get(visualId);
      if (!item) {
        const material = card ? this.face(card, id.startsWith('huzur:')) : this.back;
        const mesh = new THREE.Mesh(
          handKey ? this.heldGeometry : this.cardGeometry,
          card ? [this.edge, material, this.back] : this.back,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Apply the upright tilt first, then fan around the viewer's forward axis.
        if (handKey) {
          mesh.rotation.order = 'ZYX';
          mesh.scale.setScalar(HELD_CARD_SCALE);
        }
        mesh.position.set(-4.2, 0.6, -0.1);
        const sourceSeat = previous?.seats.find((seat) => seat.active);
        if (sourceSeat && (id.startsWith('attack:') || id.startsWith('history:')))
          mesh.position.copy(seatPosition(sourceSeat.id));
        if (handKey || parentOverride) {
          const frame = parentOverride ?? this.hand;
          frame.updateWorldMatrix(true, false);
          frame.worldToLocal(mesh.position);
        }
        item = { mesh, target: new THREE.Vector3(), angle, roll, tilt };
        this.cards.set(visualId, item);
        (parentOverride ?? (handKey ? this.hand : this.scene)).add(mesh);
      }
      const parent = parentOverride ?? (handKey ? this.hand : this.scene);
      if (item.mesh.parent !== parent) {
        // Preserve the current world pose even when an exiting card returns to the hand.
        parent.attach(item.mesh);
      }
      if (card) {
        item.mesh.geometry = handKey ? this.heldGeometry : this.cardGeometry;
        item.mesh.scale.setScalar(handKey ? HELD_CARD_SCALE : 1);
        item.mesh.rotation.reorder(handKey ? 'ZYX' : 'XYZ');
        item.mesh.material = [this.edge, this.face(card, id.startsWith('huzur:')), this.back];
        item.mesh.userData.cardKey = card.key;
        item.mesh.userData.zone = id.split(':')[0];
      }
      item.removing = false;
      item.mesh.userData.handKey = handKey;
      item.target.set(x, y, z);
      item.angle = angle;
      item.roll = roll;
      item.tilt = tilt;
    };
    for (let i = 0; i < Math.min(12, snapshot.deckCount); i++) {
      put(`deck:${i}`, null, -4.15, 0.12 + i * 0.025, 0.1);
    }
    if (snapshot.deckCount > 0)
      // The felt top is y=0.075. Keep the entire card above it, including its corners.
      put(`huzur:${snapshot.huzur.key}`, snapshot.huzur, -2.9, 0.21, 0.75, -0.12, undefined, 0.17);
    // The DOM caption already supplies the deck count at every camera angle.
    if (snapshot.discardCount > 0) {
      for (let i = 0; i < 3; i++)
        put(`discard:${i}`, null, 4.3 + i * 0.025, 0.13 + i * 0.03, 0.1, -0.12);
      if (refreshLabels) this.label(`${snapshot.discardCount} discarded`, 3.2, 0.3, 1.2);
    }
    snapshot.history.slice(-14).forEach((card, i, history) => {
      const pair = Math.floor(i / 2);
      put(
        `history:${card.key}`,
        card,
        (pair - (Math.ceil(history.length / 2) - 1) / 2) * 0.88 + 0.25 + (i % 2) * 0.16,
        0.14 + (i % 2) * 0.05,
        -0.5 + (i % 2) * 0.25,
        (i % 2) * -0.12,
      );
    });
    snapshot.attacks.forEach((card, i) =>
      put(
        `attack:${card.key}`,
        card,
        (i - (snapshot.attacks.length - 1) / 2) * 0.9 + 0.25,
        0.5,
        -0.35,
        0,
        undefined,
        0.7,
      ),
    );
    snapshot.hand.forEach((card, i) => {
      const offset = i - (snapshot.hand.length - 1) / 2;
      const spread = Math.min(0.75, 1.5 * this.camera.aspect);
      const step = Math.min(0.25, (2 * spread) / Math.max(1, snapshot.hand.length - 1));
      const angle = offset * step;
      const radius = 1.35 + (selected.has(card.key) ? 0.23 : 0);
      put(
        `hand:${card.key}`,
        card,
        Math.sin(angle) * radius * HELD_CARD_SCALE,
        (Math.cos(angle) * radius - 1.35) * HELD_CARD_SCALE,
        offset * 0.018 + (selected.has(card.key) ? 0.12 : 0),
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
      const x = Math.sin(angle) * 6.6;
      const z = Math.cos(angle) * 4.65;
      const facing = angle + Math.PI;
      let rig = this.avatars.get(seat.id);
      const preset = seat.preset || 'copper';
      if (rig && rig.presetId !== preset) {
        rig.dispose();
        this.avatars.delete(seat.id);
        rig = undefined;
      }
      if (!rig) {
        rig =
          preset === 'casual'
            ? new CasualAvatar(() => this.requestFrame())
            : new AvatarRig(preset, i * 0.83);
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
          Math.sin(targetAngle) * 6.6 - x,
          0,
          Math.cos(targetAngle) * 4.65 - z,
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
      rig.update(yaw, seat.pitch || 0, seat.played || 0, performance.now() / 1000);
      if (rig instanceof CasualAvatar) rig.setGesture(seat, snapshot.serverTimeOffset, seat.count);
      for (let n = 0; n < Math.min(7, seat.count); n++) {
        if (rig instanceof CasualAvatar) {
          const fanCount = Math.min(7, seat.count);
          const angle = (n - (fanCount - 1) / 2) * Math.min(0.25, 1.5 / Math.max(1, fanCount - 1));
          put(
            `seat:${seat.id}:${n}`,
            null,
            Math.sin(angle) * 1.35 * HELD_CARD_SCALE,
            (Math.cos(angle) * 1.35 - 1.35) * HELD_CARD_SCALE,
            (n - (fanCount - 1) / 2) * 0.018,
            0,
            undefined,
            Math.PI / 2,
            -angle,
            rig.fan,
          );
          const mesh = this.cards.get(`seat:${seat.id}:${n}`)!.mesh;
          mesh.scale.setScalar(HELD_CARD_SCALE);
          mesh.rotation.order = 'ZYX';
          continue;
        }
        const offset = (n - (Math.min(7, seat.count) - 1) / 2) * 0.17 * SEATED_PLAYER_SCALE;
        put(
          `seat:${seat.id}:${n}`,
          null,
          x + offset * Math.cos(facing) + Math.sin(facing) * 0.95 * SEATED_PLAYER_SCALE,
          SEATED_CARD_HEIGHT + n * 0.004,
          z - offset * Math.sin(facing) + Math.cos(facing) * 0.95 * SEATED_PLAYER_SCALE,
          facing,
          undefined,
          1.3,
        );
        const mesh = this.cards.get(`seat:${seat.id}:${n}`)!.mesh;
        mesh.scale.setScalar(0.55 * SEATED_PLAYER_SCALE);
        mesh.rotation.order = 'YXZ';
      }
      if (refreshLabels)
        this.label(
          `${snapshot.teamMode ? (seat.team === 0 ? '◆ Blue · ' : '● Red · ') : ''}${seat.name.slice(0, 20)} · ${seatStatus(seat, snapshot.betweenGames)}`,
          x,
          SEATED_CARD_HEIGHT + (2.15 - SEATED_CARD_HEIGHT) * SEATED_PLAYER_SCALE,
          z,
          seat.active,
        );
    });
    if (refreshLabels) {
      // Unoccupied seats follow the occupied ones clockwise.
      const offset = snapshot.spectator ? 0 : 1;
      for (let i = snapshot.seats.length + offset; i < ringCount; i++) {
        const angle = (i * Math.PI * 2) / ringCount;
        this.label('Empty seat', Math.sin(angle) * 6.6, 1.2, Math.cos(angle) * 4.65);
      }
    }
    for (const [id, card] of this.cards) {
      if (!live.has(id) && !card.removing) {
        const key = card.mesh.userData.cardKey;
        // Older pairs outside the visible history window stay on the table; retire quietly.
        if (!key || snapshot.history.some((c) => c.key === key)) {
          card.mesh.removeFromParent();
          this.cards.delete(id);
          continue;
        }
        if (card.mesh.parent === this.hand) this.scene.attach(card.mesh);
        card.removing = true;
        const recipient =
          snapshot.discardCount === previous?.discardCount &&
          (card.mesh.userData.zone === 'attack' || card.mesh.userData.zone === 'history')
            ? previous.seats.find(
                (seat) =>
                  seat.active &&
                  (snapshot.seats.find((current) => current.id === seat.id)?.count ?? 0) >
                    seat.count,
              )
            : undefined;
        if (recipient) {
          card.target.copy(seatPosition(recipient.id));
          // The identity becomes private again on pickup; only the back is shown.
          card.mesh.material = this.back;
        } else if (snapshot.discardCount > (previous?.discardCount ?? 0)) {
          card.target.set(4.3, 0.2, 0);
        } else {
          // No public destination is known (e.g. a round reset); avoid inventing a discard.
          card.mesh.removeFromParent();
          this.cards.delete(id);
          continue;
        }
        card.angle = -0.12;
        card.tilt = 0.12;
        card.roll = 0;
      }
    }
    this.previousSnapshot = snapshot;
    this.requestFrame();
  }

  recenter() {
    this.controls.recenter();
  }

  private resize = () => {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    const mobile = width < 760 || window.matchMedia('(pointer: coarse)').matches;
    this.mobileQuality = mobile;
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
        .filter((c) => !c.removing && c.mesh.userData.handKey)
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
    let moving = false;
    const now = performance.now();
    if (this.host.clientWidth < 760 && now - this.lastRender < 32) {
      this.idleTimer = setTimeout(this.requestFrame, 32 - (now - this.lastRender));
      return;
    }
    this.lastRender = now;
    for (const rig of this.avatars.values())
      moving = rig.animate(now / 1000, this.reducedMotion.matches) || moving;
    if (this.firstHands && this.hand.visible) {
      if ('animate' in this.firstHands)
        moving = this.firstHands.animate(now / 1000, this.reducedMotion.matches) || moving;
      if (!('animate' in this.firstHands)) {
        const t = Math.min(1, Math.max(0, (now - this.playStarted) / 600));
        this.firstHands.root.position.z = this.reducedMotion.matches
          ? 0
          : -Math.sin(t * Math.PI) * 0.25;
        moving = moving || (!this.reducedMotion.matches && t > 0 && t < 1);
      }
    }
    for (const [id, card] of this.cards) {
      this.targetPosition.copy(card.target);
      if (this.canSelect && card.mesh.userData.handKey === this.hoverKey)
        this.targetPosition.y += 0.22;
      const distance = card.mesh.position.distanceTo(this.targetPosition);
      const tiltDelta = Math.abs(card.mesh.rotation.x - card.tilt);
      if (this.reducedMotion.matches || distance < 0.004) {
        card.mesh.position.copy(this.targetPosition);
        card.mesh.rotation.y = card.angle;
        card.mesh.rotation.z = card.roll;
        card.mesh.rotation.x = card.tilt;
        if (card.removing) {
          card.mesh.parent?.remove(card.mesh);
          this.cards.delete(id);
        }
      } else {
        card.mesh.position.lerp(this.targetPosition, 0.22);
        card.mesh.rotation.y = THREE.MathUtils.lerp(card.mesh.rotation.y, card.angle, 0.22);
        card.mesh.rotation.z = THREE.MathUtils.lerp(card.mesh.rotation.z, card.roll, 0.22);
        card.mesh.rotation.x = THREE.MathUtils.lerp(card.mesh.rotation.x, card.tilt, 0.22);
        if (tiltDelta > 0.002) moving = true;
        moving = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) {
      this.host.dataset.renderCalls = String(this.renderer.info.render.calls);
      this.host.dataset.geometries = String(this.renderer.info.memory.geometries);
      this.host.dataset.textures = String(this.renderer.info.memory.textures);
      this.host.dataset.avatarCount = String(this.avatars.size);
    }
    if (moving) this.idleTimer = setTimeout(this.requestFrame, 16);
    else if (this.avatars.size > 0 && !this.reducedMotion.matches)
      this.idleTimer = setTimeout(this.requestFrame, this.mobileQuality ? 250 : 125);
  };

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
