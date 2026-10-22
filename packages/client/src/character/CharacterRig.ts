import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
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
import type { Clip } from './animation.ts';
import { characterMaterial, generateCharacter, paint, type Appearance } from './generate.ts';
import {
  carryMatrix,
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
    if (this.pose) this.actions.push({ clip: REACTIONS[id], start: now, targets: {} });
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

/** Another player at the table, holding their cards in `fan`. */
export class SeatedCharacter extends CharacterBody {
  readonly fan = new THREE.Group();
  private yaw = 0;
  private pitch = 0;
  private shownYaw = 0;
  private shownPitch = 0;
  private lastFrame = 0;

  constructor(presetId: string, changed: () => void) {
    super(presetId, false, changed);
    this.root.name = 'seated-character';
    this.root.add(this.fan);
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

  animate(now: number, reduced: boolean) {
    if (!this.pose) return false;
    const blend = reduced ? 1 : 1 - Math.exp(-12 * Math.min(0.2, now - this.lastFrame));
    this.lastFrame = now;
    this.shownYaw = THREE.MathUtils.lerp(this.shownYaw, this.yaw, blend);
    this.shownPitch = THREE.MathUtils.lerp(this.shownPitch, this.pitch, blend);
    const count = Math.min(7, this.count);
    // The fan is carried in front of the eyes as they look, not as an emote bows the head.
    this.root.updateWorldMatrix(true, true);
    this.pose.look(this.shownYaw, this.shownPitch);
    const frame = carryMatrix(
      this.pose.view(),
      undefined,
      this.root.getWorldScale(new THREE.Vector3()).x,
    );
    const moving = this.pose.pose({
      yaw: this.shownYaw,
      pitch: this.shownPitch,
      reduced,
      count,
      half: fanHalfAngle(count),
      frame,
      clips: this.clips(),
    });
    const local = this.root.matrixWorld.clone().invert().multiply(frame);
    local.decompose(this.fan.position, this.fan.quaternion, this.fan.scale);
    return (
      moving ||
      (!reduced &&
        (Math.abs(this.shownYaw - this.yaw) > 0.002 ||
          Math.abs(this.shownPitch - this.pitch) > 0.002))
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
