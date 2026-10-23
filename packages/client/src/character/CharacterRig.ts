import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { avatarPreset, type PublicGesture } from '@durak/shared';
import { CharacterPose, type ActiveClip } from './CharacterPose.ts';
import {
  ACTIONS,
  EMOTES,
  FREE_HAND_EMOTES,
  REACTIONS,
  type ActionId,
  type ReactionId,
} from './animations/registry.ts';
import { clipWeight, type Clip, type Vec3 } from './animation.ts';
import { BODY } from './spec.ts';
import { characterMaterial, generateCharacter, paint, type Appearance } from './generate.ts';
import {
  carryMatrix,
  CARRY_RAISE,
  CARRY_Y,
  CHARACTER_FLOOR,
  CHARACTER_SCALE,
  fanHalfAngle,
  SEAT_RADIUS_Z,
} from '../components/three/CharacterSpace.ts';

/** Every character is the same rig; a preset only chooses colours and a hair style. */
export function appearanceFor(presetId: string): Appearance {
  const preset = avatarPreset(presetId);
  return {
    skin: preset.skin,
    hair: preset.hair,
    shirt: preset.shirt,
    hairStyle: preset.id === 'casual' ? 4 : preset.hairStyle,
  };
}

let source: Promise<THREE.Object3D> | undefined;
/** The shipped GLB, loaded once; if it cannot load, the identical generated rig. */
function characterSource() {
  source ??= new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}models/character/base.glb`)
    .then(({ scene }) => scene as THREE.Object3D)
    .catch(() => generateCharacter());
  return source;
}

/** Tests replace the shared source, for example with a parsed copy of the GLB. */
export function setCharacterSource(value: Promise<THREE.Object3D> | undefined) {
  source = value;
}

/** A private copy: its own bones, recoloured geometry and one material. */
function instantiate(template: THREE.Object3D, look: Appearance, firstPerson: boolean) {
  const model = clone(template);
  const material = characterMaterial();
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    node.geometry = node.geometry.clone();
    paint(node.geometry, look);
    node.material = material;
    // Posed limbs leave their bind-pose bounds; the camera is close in first person.
    node.frustumCulled = false;
    const hair = /^Hair(\d+)$/.exec(node.name);
    if (hair) node.visible = !firstPerson && Number(hair[1]) === look.hairStyle;
    if (node.name === 'HeadMesh') node.visible = !firstPerson;
  });
  return model;
}

/** Each load owns its geometry, skeleton and materials, including a late result after disposal. */
export function disposeCharacter(root: THREE.Object3D) {
  const resources = new Set<{ dispose(): void }>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    resources.add(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => resources.add(material));
    if (node instanceof THREE.SkinnedMesh) resources.add(node.skeleton);
  });
  resources.forEach((resource) => resource.dispose());
  root.removeFromParent();
}

/** While the right hand holds cards, gestures that mean the same with either hand use the
 * free left hand; the rest (touching the right ear) borrow the right and pass it the fan. */
function gestureClips(gesture: PublicGesture, now: number, holding: boolean): ActiveClip[] {
  const id = gesture.gestureId;
  const clip = id ? (holding && FREE_HAND_EMOTES[id]) || EMOTES[id] : undefined;
  if (!clip || !gesture.gestureStartedAt) return [];
  return [{ clip, time: now - gesture.gestureStartedAt }];
}

/** Shared lifecycle for both views: load, pose, dispose. */
abstract class CharacterBody {
  readonly root = new THREE.Group();
  protected pose?: CharacterPose;
  protected model?: THREE.Object3D;
  protected disposed = false;
  protected gesture: PublicGesture = {};
  protected offset = 0;
  protected count = 5;

  constructor(
    readonly presetId: string,
    firstPerson: boolean,
    changed: () => void,
  ) {
    characterSource().then(
      (template) => {
        if (this.disposed) return;
        try {
          this.model = instantiate(template, appearanceFor(presetId), firstPerson);
          this.root.add(this.model);
          this.pose = new CharacterPose(this.model);
          this.loaded();
        } catch {
          if (this.model) disposeCharacter(this.model);
          this.model = undefined;
          this.pose = undefined;
        }
        changed();
      },
      () => {
        if (!this.disposed) changed();
      },
    );
  }

  protected loaded() {}

  setGesture(gesture: PublicGesture, offset = 0, count = this.count) {
    this.gesture = gesture;
    this.offset = offset;
    this.count = count;
  }

  private actions: { clip: Clip; start: number; targets: Record<string, THREE.Matrix4> }[] = [];
  /** Time for actions and reactions, in milliseconds; a preview can pin it to one moment. */
  clock = () => performance.now();

  /** The hand that acts: the free left while holding cards, otherwise the nearer hand. */
  private actingSide(target?: THREE.Vector3) {
    // The right hand holds the fan; the left is free for the table.
    if (this.count > 0) return 'L';
    if (!target) return 'R';
    this.root.updateWorldMatrix(true, false);
    // The character's left is +X in its own frame.
    return this.root.worldToLocal(target.clone()).x > 0 ? 'L' : 'R';
  }

  /**
   * Act out a public card action toward world-space targets (`table`, `deck`). Targets
   * are framed by the seat's facing so the same clip works from every chair.
   */
  act(id: ActionId, targets: Record<string, THREE.Vector3>, now = this.clock()) {
    if (!this.pose) return;
    this.root.updateWorldMatrix(true, false);
    const rotation = this.root.getWorldQuaternion(new THREE.Quaternion());
    const scale = this.root.getWorldScale(new THREE.Vector3());
    const frames = Object.fromEntries(
      Object.entries(targets).map(([name, point]) => [
        name,
        new THREE.Matrix4().compose(point, rotation, scale),
      ]),
    );
    const side = this.actingSide(Object.values(targets)[0]);
    this.actions.push({ clip: ACTIONS[id][side], start: now, targets: frames });
  }

  /** A local reaction to the public game, such as crying when left holding the cards. */
  react(id: ReactionId, now = this.clock()) {
    // Holding cards, a reaction that suits either hand uses the free one.
    const clip = (this.count > 0 && FREE_HAND_EMOTES[id]) || REACTIONS[id];
    if (this.pose) this.actions.push({ clip, start: now, targets: {} });
  }

  /** How far the held cards are drawn up (0 to 1, times `CARRY_RAISE`) while the free
   * hand acts at the table, so it passes under them. */
  cardsRaised(now = this.clock()) {
    return Math.max(0, ...this.actions.map(({ clip, start }) => clipWeight(clip, now - start)));
  }

  /** Where a card leaves (or reaches) the hand acting toward `target`, in world space. */
  palm(target?: THREE.Vector3) {
    return this.model
      ?.getObjectByName(`SocketPalm${this.actingSide(target)}`)
      ?.getWorldPosition(new THREE.Vector3());
  }

  protected clips(): ActiveClip[] {
    const now = this.clock();
    this.actions = this.actions.filter((action) => now - action.start < action.clip.duration);
    return [
      ...gestureClips(this.gesture, Date.now() + this.offset, this.count > 0),
      ...this.actions.map(({ clip, start, targets }) => ({ clip, time: now - start, targets })),
    ];
  }

  dispose() {
    this.disposed = true;
    if (this.model) disposeCharacter(this.model);
    this.root.removeFromParent();
  }
}

/**
 * A critically damped spring: it sets off gently, travels and settles on `target` without
 * overshooting, like a head turning to look. `rate` is how quickly (per second).
 */
class Spring {
  velocity = 0;
  constructor(public value = 0) {}

  step(target: number, dt: number, rate: number) {
    const offset = this.value - target;
    const decay = Math.exp(-rate * dt);
    const push = (this.velocity + rate * offset) * dt;
    this.value = target + (offset + push) * decay;
    this.velocity = (this.velocity - rate * push) * decay;
  }

  snap(target: number) {
    this.value = target;
    this.velocity = 0;
  }

  settled(target: number) {
    return Math.abs(this.value - target) < 0.002 && Math.abs(this.velocity) < 0.01;
  }
}

let chairMesh: THREE.Mesh | undefined;
/**
 * A plain wooden chair in the character's frame (metres, facing +Z): seat top at the seat
 * height, back just behind the sitter. One geometry and material, shared by every seat.
 */
function chair() {
  if (!chairMesh) {
    const part = (size: Vec3, at: Vec3, tilt = 0) =>
      new THREE.BoxGeometry(...size).rotateX(tilt).translate(...at);
    const parts = [
      part([0.44, 0.04, 0.42], [0, BODY.seat - 0.02, 0.04]),
      ...[-1, 1].flatMap((x) => [
        part([0.035, BODY.seat - 0.04, 0.035], [x * 0.19, (BODY.seat - 0.04) / 2, 0.22]),
        part([0.035, BODY.seat - 0.04, 0.035], [x * 0.19, (BODY.seat - 0.04) / 2, -0.15]),
        // Back posts, leaning back a little.
        part([0.035, 0.5, 0.035], [x * 0.19, BODY.seat + 0.22, -0.17], -0.1),
      ]),
      part([0.4, 0.09, 0.025], [0, BODY.seat + 0.42, -0.19], -0.1),
      part([0.4, 0.05, 0.022], [0, BODY.seat + 0.22, -0.17], -0.1),
    ];
    chairMesh = new THREE.Mesh(
      mergeGeometries(parts),
      new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: 0.62 }),
    );
    parts.forEach((geometry) => geometry.dispose());
    chairMesh.name = 'chair';
    chairMesh.castShadow = true;
    chairMesh.receiveShadow = true;
  }
  return chairMesh.clone();
}

/** Another player at the table, sitting on a chair and holding their cards in `fan`. */
export class SeatedCharacter extends CharacterBody {
  readonly fan = new THREE.Group();
  private yaw = 0;
  private pitch = 0;
  /** The head turns to a new look quickly; the torso follows more slowly behind it. */
  private head = { yaw: new Spring(), pitch: new Spring() };
  private torso = new Spring();
  private lastFrame = 0;

  constructor(presetId: string, changed: () => void) {
    super(presetId, false, changed);
    this.root.name = 'seated-character';
    this.root.add(this.fan, chair());
    // Cards wait for the body, rather than floating at the chair.
    this.fan.visible = false;
  }

  protected override loaded() {
    this.fan.visible = true;
    this.animate(0, true);
  }

  update(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  /** Pose for `now` (seconds); returns whether the body is still visibly moving. */
  animate(now: number, reduced: boolean) {
    if (!this.pose) return false;
    const dt = Math.min(0.1, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    if (reduced) {
      this.head.yaw.snap(this.yaw);
      this.head.pitch.snap(this.pitch);
      this.torso.snap(this.yaw);
    } else {
      this.head.yaw.step(this.yaw, dt, 11);
      this.head.pitch.step(this.pitch, dt, 11);
      this.torso.step(this.yaw, dt, 4.5);
    }
    const yaw = this.head.yaw.value;
    const pitch = this.head.pitch.value;
    const motion = { torso: this.torso.value, time: reduced ? undefined : now * 1000 };
    const count = Math.min(7, this.count);
    // The fan is carried in front of the eyes as they look, not as an emote bows the head.
    this.root.updateWorldMatrix(true, true);
    this.pose.look(yaw, pitch, motion);
    const frame = carryMatrix(
      this.pose.view(),
      CARRY_Y + CARRY_RAISE * this.cardsRaised(),
      this.root.getWorldScale(new THREE.Vector3()).x,
    );
    const moving = this.pose.pose({
      yaw,
      pitch,
      reduced,
      count,
      half: fanHalfAngle(count),
      frame,
      clips: this.clips(),
      motion,
    });
    const local = this.root.matrixWorld.clone().invert().multiply(frame);
    local.decompose(this.fan.position, this.fan.quaternion, this.fan.scale);
    return (
      moving ||
      (!reduced &&
        !(
          this.head.yaw.settled(this.yaw) &&
          this.head.pitch.settled(this.pitch) &&
          this.torso.settled(this.yaw)
        ))
    );
  }
}

/**
 * The local player's own body in their chair. The camera sits at its eyes; the head is
 * hidden; the held cards are a camera child the hands reach for.
 */
export class FirstPersonCharacter extends CharacterBody {
  private half = fanHalfAngle(5);

  constructor(
    presetId: string,
    changed: () => void,
    private options?: {
      camera: THREE.PerspectiveCamera;
      cards: THREE.Object3D;
      look: () => { yaw: number; pitch: number };
    },
  ) {
    super(presetId, true, changed);
    this.root.name = 'first-person-character';
    this.root.position.set(0, CHARACTER_FLOOR, SEAT_RADIUS_Z);
    this.root.rotation.y = Math.PI;
    this.root.scale.setScalar(CHARACTER_SCALE);
  }

  protected override loaded() {
    this.animate(0, true);
  }

  /** Cards held and the fan's half-angle as the renderer laid it out. */
  setCardCount(count: number, half = fanHalfAngle(count)) {
    this.count = count;
    this.half = half;
  }

  view(yaw: number, pitch: number) {
    if (!this.pose) return undefined;
    this.root.updateWorldMatrix(true, true);
    this.pose.look(yaw, pitch);
    return this.pose.view();
  }

  animate(_now: number, reduced: boolean) {
    if (!this.pose) return false;
    const { yaw, pitch } = this.options?.look() ?? { yaw: 0, pitch: 0 };
    const view = this.view(yaw, pitch)!;
    if (this.options) {
      this.options.camera.position.copy(view.position);
      this.options.camera.quaternion.copy(view.quaternion);
      this.options.camera.updateWorldMatrix(true, true);
      this.options.cards.updateWorldMatrix(true, false);
    }
    return this.pose.pose({
      yaw,
      pitch,
      reduced,
      count: this.count,
      half: this.half,
      frame: this.options?.cards.matrixWorld,
      clips: this.clips(),
    });
  }
}
