import * as THREE from 'three';
import { avatarPreset, LOOK_PITCH_MAX, LOOK_PITCH_MIN, LOOK_YAW_LIMIT } from '@durak/shared';
import { SeatedCharacter } from '../character/CharacterRig.ts';
import { CARD_SIZE } from '../character/spec.ts';
import {
  CHARACTER_FLOOR,
  CHARACTER_SCALE,
  fanStep,
  heldCard,
  HELD_CARD_SCALE,
  NEUTRAL_LOOK_DOWN,
  SEAT_RADIUS_X,
  SEAT_RADIUS_Z,
  TABLE_CARD_SCALE,
  TABLE_LAYERS,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  TABLE_TOP,
  tableClearance,
} from '../components/three/CharacterSpace.ts';
import { cardFaceUrl } from '../game/cardArt.ts';
import {
  actionDuration,
  cardAt,
  cardsAt,
  gestureDuration,
  latest,
  shotAt,
  type Card,
  type Place,
  type Seat,
  type ShotFile,
  type Timeline,
} from './scene.ts';

// The table's real-size layout, as TableRenderer lays it out.
const cm = (value: number) => (value * CHARACTER_SCALE) / 100;
const card = (value: number) => cm(value * CARD_SIZE);
const LAYOUT = {
  deck: new THREE.Vector3(-card(36), TABLE_TOP, card(1)),
  trump: new THREE.Vector3(-card(25), TABLE_TOP, card(9)),
  discard: new THREE.Vector3(card(36), TABLE_TOP, card(1)),
  spacing: card(9.5),
  attackZ: card(2),
};
const TABLE_CENTRE = new THREE.Vector3(cm(2), TABLE_TOP + cm(3), -cm(4));
const DECK_TOP = LAYOUT.deck.clone().setY(TABLE_TOP + cm(4));
/** Where seated eyes are, before a smaller body scales them down toward the floor. */
const EYE_HEIGHT = 1.45;

/** Attack slots fill from the middle outward, so the row stays put as cards arrive. */
function slot(place: Place) {
  if (place.at !== 'attack' && place.at !== 'defense') return undefined;
  const i = place.index;
  const x = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * LAYOUT.spacing;
  const base = new THREE.Vector3(x, TABLE_TOP + cm(0.3), LAYOUT.attackZ);
  // A defending card lies across its attack, a little forward, as history pairs do.
  return place.at === 'defense' ? base.add(new THREE.Vector3(cm(1.8), cm(0.3), cm(3))) : base;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/** Seeded PRNG (mulberry32): blink and glance phases come out the same on every take. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Actor {
  seat: Seat;
  rig: SeatedCharacter;
  fanCount: number;
  position: THREE.Vector3;
  facing: number;
  eyes: THREE.Vector3;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 80);
  private actors = new Map<string, Actor>();
  private meshes = new Map<string, THREE.Mesh>();
  private deck: THREE.Mesh[] = [];
  private huzur?: THREE.Mesh;
  private discard: THREE.Mesh[] = [];
  private faces = new Map<string, THREE.MeshStandardMaterial>();
  private back = new THREE.MeshStandardMaterial({ color: '#203a52', roughness: 0.7 });
  private edge = new THREE.MeshStandardMaterial({ color: '#d7d6cc', roughness: 0.8 });
  private geometry = new THREE.BoxGeometry(0.82, 0.012, 1.2);
  private loads: Promise<unknown>[] = [];
  private lastTime = -Infinity;
  timeline?: Timeline;

  constructor(
    host: HTMLElement,
    readonly width: number,
    readonly height: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.renderer.domElement);
    this.camera.aspect = width / height;
    this.scene.add(new THREE.HemisphereLight('#e0edf6', '#182b3c', 2.1));
    const key = new THREE.DirectionalLight('#fff0db', 3.5);
    key.position.set(-3, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6 });
    key.shadow.bias = -0.001;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#a8d9fa', 1.4);
    fill.position.set(5, 4, -5);
    this.scene.add(fill);
    TABLE_LAYERS.forEach(({ grow, top, depth }, i) => {
      const layer = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, depth, 96),
        new THREE.MeshStandardMaterial({
          color: ['#38251f', '#6a4939', '#c69c72', '#2f6382'][i],
          roughness: [0.7, 0.65, 0.4, 1][i],
        }),
      );
      layer.scale.set(TABLE_RADIUS_X + grow, 1, TABLE_RADIUS_Z + grow);
      layer.position.y = top - depth / 2;
      layer.receiveShadow = true;
      this.scene.add(layer);
    });
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.95 }),
    );
    floor.position.y = CHARACTER_FLOOR;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /** Seat the cast and lay out the cards; resolves once every body and card face is loaded. */
  async load(timeline: Timeline) {
    this.clear();
    this.timeline = timeline;
    this.scene.background = new THREE.Color(timeline.background);
    const random = Math.random;
    Math.random = seeded(timeline.seed);
    this.loads = [this.texture(`/assets/cardbacks/cardback_${timeline.back}.png`, this.back)];
    for (const seat of timeline.seats) {
      let loaded!: () => void;
      this.loads.push(new Promise<void>((resolve) => (loaded = resolve)));
      const rig = new SeatedCharacter(seat.preset, () => {
        rig.root.traverse((node) => (node.castShadow = true));
        loaded();
      });
      rig.table = tableClearance;
      const position = new THREE.Vector3(
        Math.sin(seat.angle) * SEAT_RADIUS_X,
        CHARACTER_FLOOR,
        Math.cos(seat.angle) * SEAT_RADIUS_Z,
      );
      const facing = seat.angle + Math.PI;
      rig.root.position.copy(position);
      rig.root.rotation.y = facing;
      rig.root.scale.setScalar(CHARACTER_SCALE);
      this.scene.add(rig.root);
      const size = avatarPreset(seat.preset).size ?? 1;
      const eyes = position.clone().setY(CHARACTER_FLOOR + (EYE_HEIGHT - CHARACTER_FLOOR) * size);
      this.actors.set(seat.name, { seat, rig, fanCount: -1, position, facing, eyes });
    }
    for (const track of timeline.cards) {
      const mesh = this.card(track.card);
      mesh.visible = false;
      this.meshes.set(track.id, mesh);
    }
    for (let i = 0; i < Math.min(12, timeline.deck); i++) {
      const mesh = this.card();
      mesh.position.set(LAYOUT.deck.x, TABLE_TOP + cm(0.3) + i * cm(0.25), LAYOUT.deck.z);
      this.deck.push(mesh);
    }
    if (timeline.trump && timeline.deck > 0) {
      this.huzur = this.card(timeline.trump);
      this.huzur.position.set(LAYOUT.trump.x, TABLE_TOP + cm(0.3), LAYOUT.trump.z);
      this.huzur.rotation.y = -0.12;
    }
    for (let i = 0; i < 3; i++) {
      const mesh = this.card();
      mesh.position.set(
        LAYOUT.discard.x + i * cm(0.3),
        TABLE_TOP + cm(0.3) + i * cm(0.3),
        LAYOUT.discard.z,
      );
      mesh.rotation.y = -0.12;
      mesh.visible = false;
      this.discard.push(mesh);
    }
    await Promise.all(this.loads);
    Math.random = random;
    this.lastTime = -Infinity;
  }

  /**
   * Pose everything for `t` ms. A jump (anything but the next frame, unless `settle` says
   * otherwise) first runs the last second, so heads and bodies arrive where they would be.
   */
  seek(t: number, settle?: boolean) {
    const step = 1000 / (this.timeline?.fps ?? 30);
    if (settle ?? !(t > this.lastTime && t - this.lastTime <= step * 1.5))
      for (let warm = t - 1200; warm < t; warm += step) this.pose(warm);
    this.pose(t);
    this.lastTime = t;
    this.render(t);
  }

  render(t = this.lastTime) {
    this.frame(t);
    this.renderer.render(this.scene, this.camera);
  }

  private pose(t: number) {
    const timeline = this.timeline;
    if (!timeline) return;
    for (const actor of this.actors.values()) {
      const { rig, seat } = actor;
      const name = seat.name;
      const count = cardsAt(timeline, name, t);
      rig.clock = () => t;
      rig.clearActions();
      for (const cue of timeline.actions[name] ?? []) {
        if (cue.at > t || t >= cue.at + actionDuration(cue.id)) continue;
        // The hand that acts is chosen from the cards held as the action starts.
        rig.setGesture({}, 0, cue.count);
        if (cue.id === 'victory') rig.react('victory', cue.at);
        else if (cue.id === 'play') rig.act('play', { table: slot(cue.place!)! }, cue.at);
        else if (cue.id === 'pickup') rig.act('pickup', { table: TABLE_CENTRE.clone() }, cue.at);
        else rig.act('draw', { deck: DECK_TOP.clone() }, cue.at);
      }
      const gesture = latest(timeline.gestures[name] ?? [], t);
      const active = gesture && t < gesture.at + gestureDuration;
      // Gestures run on the server clock; an offset sets that clock to the scene's time.
      rig.setGesture(
        active ? { gestureId: gesture.id, gestureStartedAt: gesture.at } : {},
        t - Date.now(),
        count,
      );
      const look = latest(timeline.looks[name] ?? [], t);
      const [yaw, pitch] = this.lookAngles(actor, look?.target, t);
      rig.update(yaw, pitch);
      this.fan(actor, count);
      rig.animate(t / 1000, false);
    }
    this.cards(t);
  }

  /** Yaw and pitch for a seat to look at a target: a cast name, the table, deck or camera. */
  private lookAngles(actor: Actor, target: string | undefined, t: number): [number, number] {
    if (!target) return [0, 0];
    if (target === 'down') return [0, LOOK_PITCH_MIN];
    const other = this.actors.get(target);
    const point =
      target === 'table'
        ? TABLE_CENTRE
        : target === 'deck'
          ? DECK_TOP
          : target === 'camera'
            ? this.shot(t).eye
            : other?.eyes;
    if (!point) return [0, 0];
    const offset = point.clone().sub(actor.eyes);
    const yaw =
      THREE.MathUtils.euclideanModulo(
        Math.atan2(offset.x, offset.z) - actor.facing + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    const pitch = Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) + NEUTRAL_LOOK_DOWN;
    return [
      THREE.MathUtils.clamp(yaw, -LOOK_YAW_LIMIT, LOOK_YAW_LIMIT),
      THREE.MathUtils.clamp(pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX),
    ];
  }

  /** The held fan: up to seven backs, rebuilt only when the count changes. */
  private fan(actor: Actor, count: number) {
    const shown = Math.min(7, count);
    if (actor.fanCount === shown) return;
    actor.fanCount = shown;
    actor.rig.fan.clear();
    const step = fanStep(shown);
    for (let i = 0; i < shown; i++) {
      const { angle, position } = heldCard(i, shown, step);
      const mesh = new THREE.Mesh(this.geometry, [
        this.edge,
        this.edge,
        this.back,
        this.back,
        this.edge,
        this.edge,
      ]);
      mesh.position.copy(position);
      mesh.rotation.order = 'ZYX';
      mesh.rotation.set(Math.PI / 2, 0, -angle);
      mesh.scale.setScalar(HELD_CARD_SCALE);
      mesh.castShadow = true;
      actor.rig.fan.add(mesh);
    }
  }

  private cards(t: number) {
    const timeline = this.timeline!;
    for (const track of timeline.cards) {
      const mesh = this.meshes.get(track.id)!;
      const where = cardAt(track, t);
      if (!where || (where.progress >= 1 && where.to.at === 'hand')) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const toward = slot(where.to);
      const from = this.place(where.from, toward);
      const to = this.place(where.to, toward);
      const u = easeOut(where.progress);
      mesh.position.lerpVectors(from, to, u);
      // A small arc through the air between places.
      mesh.position.y += Math.sin(Math.PI * where.progress) * cm(6) * (where.progress < 1 ? 1 : 0);
      const flat = where.to.at === 'discard' || where.from.at === 'deck';
      const faceDown = where.to.at === 'discard' ? u : where.from.at === 'deck' ? 1 : 0;
      mesh.rotation.set(0, where.to.at === 'defense' ? -0.12 * u : 0, faceDown * Math.PI);
      if (!flat && where.from.at === 'palm' && where.progress >= 1) mesh.rotation.x = -0.25;
    }
    const drawn = timeline.deckDraws.filter((at) => at <= t).length;
    const left = timeline.deck - drawn;
    this.deck.forEach((mesh, i) => (mesh.visible = i < Math.min(12, left)));
    if (this.huzur) this.huzur.visible = left > 0;
    const discarded = timeline.cards.filter((track) => {
      const where = cardAt(track, t);
      return where?.to.at === 'discard' && where.progress >= 1;
    }).length;
    this.discard.forEach((mesh, i) => (mesh.visible = i < discarded));
    // Landed discards sit in the pile meshes; only those still in flight are drawn alone.
    for (const track of timeline.cards) {
      const where = cardAt(track, t);
      if (where?.to.at === 'discard' && where.progress >= 1)
        this.meshes.get(track.id)!.visible = false;
    }
  }

  /** The world point of a place; a hand reaches toward `toward` when the card leaves it. */
  private place(place: Place, toward?: THREE.Vector3) {
    switch (place.at) {
      case 'palm':
      case 'hand': {
        const actor = this.actors.get(place.who)!;
        if (place.at === 'palm') {
          const palm = actor.rig.palm(toward);
          if (palm) return palm;
        }
        return actor.rig.fan.getWorldPosition(new THREE.Vector3());
      }
      case 'attack':
      case 'defense':
        return slot(place)!;
      case 'deck':
        return DECK_TOP.clone();
      case 'discard':
        return LAYOUT.discard.clone().setY(TABLE_TOP + cm(1));
    }
  }

  /** Eye and target for a shot, after its lift and orbit. */
  private framing(shot: ShotFile) {
    const view = this.named(shot);
    if (shot.orbit) {
      const offset = view.eye.clone().sub(view.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(shot.orbit));
      view.eye.copy(view.target).add(offset);
    }
    if (shot.lift) view.eye.y += shot.lift;
    return view;
  }

  private named(shot: ShotFile): { eye: THREE.Vector3; target: THREE.Vector3; fov: number } {
    const [kind, subject] = shot.shot.split(':') as [string, string | undefined];
    const actor = subject ? this.actors.get(subject) : undefined;
    if (actor) {
      const inward = actor.position.clone().setY(0).negate().normalize();
      const side = new THREE.Vector3(-inward.z, 0, inward.x);
      const eyes = actor.eyes;
      // A smaller body is framed from nearer, so it fills the shot as a full-size one does.
      const size = avatarPreset(actor.seat.preset).size ?? 1;
      if (kind === 'face')
        return {
          // Across the table at eye level, just over the held fan: face, hands and cards.
          eye: eyes
            .clone()
            .addScaledVector(inward, 3.6 * size)
            .add(new THREE.Vector3(0, 0.2 * size, 0)),
          target: eyes.clone().add(new THREE.Vector3(0, -0.3 * size, 0)),
          fov: 34,
        };
      if (kind === 'over')
        return {
          // High behind the shoulder, so the head sits low in the corner, clear of the cards.
          eye: eyes
            .clone()
            .addScaledVector(inward, -1.6)
            .addScaledVector(side, 1.3)
            .add(new THREE.Vector3(0, 1.7, 0)),
          target: TABLE_CENTRE.clone().addScaledVector(inward, 0.4),
          fov: 50,
        };
      // hand
      const fan = actor.rig.fan.getWorldPosition(new THREE.Vector3());
      return {
        eye: fan
          .clone()
          .addScaledVector(inward, 2.2 * size)
          .addScaledVector(side, 0.6 * size)
          .add(new THREE.Vector3(0, 0.6 * size, 0)),
        target: fan,
        fov: 34,
      };
    }
    if (kind === 'top')
      return { eye: new THREE.Vector3(0, 14, 0.01), target: new THREE.Vector3(0, 0, 0), fov: 46 };
    if (kind === 'table')
      return {
        // Above the table's near edge, inside the ring of seats, so no head is in the way.
        eye: new THREE.Vector3(0, 4.4, 2.5),
        target: new THREE.Vector3(0, TABLE_TOP, LAYOUT.attackZ - 0.6),
        fov: 44,
      };
    if (kind === 'custom')
      return {
        eye: new THREE.Vector3(...shot.eye!),
        target: new THREE.Vector3(...shot.target!),
        fov: 40,
      };
    return {
      eye: new THREE.Vector3(0, 9.2, 7.4),
      target: new THREE.Vector3(0, -0.8, 0.4),
      fov: 50,
    };
  }

  /** The camera at `t`: the shot, eased from the last one, pushed in and shaken. */
  private shot(t: number) {
    const { shot, previous, blend, held } = shotAt(this.timeline!, t);
    const view = this.framing(shot);
    if (previous && blend < 1) {
      const from = this.framing(previous);
      const u = smooth(blend);
      view.eye.lerpVectors(from.eye, view.eye, u);
      view.target.lerpVectors(from.target, view.target, u);
      view.fov = THREE.MathUtils.lerp(from.fov / (previous.zoom ?? 1), view.fov, u);
    }
    if (shot.push) view.eye.lerp(view.target, shot.push * smooth(held));
    view.fov /= shot.zoom ?? 1;
    if (shot.shake) {
      const s = t / 1000;
      view.eye.add(
        new THREE.Vector3(
          Math.sin(s * 13.1) + Math.sin(s * 7.3) * 0.6,
          Math.sin(s * 11.7 + 1) * 0.8,
          Math.sin(s * 9.4 + 2) * 0.5,
        ).multiplyScalar(shot.shake),
      );
    }
    return view;
  }

  private frame(t: number) {
    if (!this.timeline) return;
    const { eye, target, fov } = this.shot(t);
    this.camera.position.copy(eye);
    this.camera.lookAt(target);
    // Shots are framed for the narrow side: portrait widens the vertical lens to keep width.
    const aspect = this.camera.aspect;
    const narrow = THREE.MathUtils.degToRad(fov);
    this.camera.fov =
      aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(narrow / 2) / aspect)) : fov;
    this.camera.updateProjectionMatrix();
  }

  private card(face?: Card) {
    const material = face ? this.face(face) : this.back;
    const mesh = new THREE.Mesh(this.geometry, [
      this.edge,
      this.edge,
      material,
      this.back,
      this.edge,
      this.edge,
    ]);
    mesh.scale.setScalar(TABLE_CARD_SCALE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private face(face: Card) {
    let material = this.faces.get(face.key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      this.faces.set(face.key, material);
      const url = cardFaceUrl(face);
      if (url) this.loads.push(this.texture(url, material));
    }
    return material;
  }

  private texture(url: string, material: THREE.MeshStandardMaterial) {
    return new THREE.TextureLoader().loadAsync(url).then(
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        material.map = texture;
        material.needsUpdate = true;
      },
      () => undefined,
    );
  }

  private clear() {
    for (const { rig } of this.actors.values()) rig.dispose();
    this.actors.clear();
    for (const mesh of [
      ...this.meshes.values(),
      ...this.deck,
      ...this.discard,
      ...(this.huzur ? [this.huzur] : []),
    ])
      mesh.removeFromParent();
    this.meshes.clear();
    this.deck = [];
    this.discard = [];
    this.huzur = undefined;
    for (const material of this.faces.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.faces.clear();
  }
}
