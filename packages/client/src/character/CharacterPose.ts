import * as THREE from 'three';
import {
  clipWeight,
  mirrorClip,
  sidesOf,
  type Clip,
  type HandShape,
  type Reach,
  type Vec3,
} from './animation.ts';
import { aim, handBasis, solveLimb, world, worldRotation } from './ik.ts';
import { FINGERS, HAND, SKELETON, type Side } from './spec.ts';
import {
  carryMatrix,
  fanHalfAngle,
  headLook,
  heldCard,
  HELD_CARD,
  heldCardBow as bow,
  HELD_CARD_SCALE,
} from '../components/three/CharacterSpace.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CARD_HALF_WIDTH = HELD_CARD.width / 2;
const CARD_HALF_HEIGHT = HELD_CARD.height / 2;
const CARD_HALF_THICKNESS = HELD_CARD.thickness / 2;

/**
 * The thumb pinch on the outer card of the fan, in the right hand's frame (the left
 * mirrors it): fingers along +Z, thumb side +Y, palm +X.
 */
export const GRIP = {
  /** Fingers lean in from the outer card's upright: base, per radian of fan, limit. */
  lean: [0, 0.6, 0.45],
  /** Where the outer card's bottom-outer corner sits in the hand: on the radial side of
   * the index finger, beyond the thumb web. */
  anchor: [-0.012, 0.066, 0.115] as Vec3,
  /** Nearly straight fingers: curl at each joint, and a slight fan. */
  curl: [0.1, 0.08, 0.05],
  spread: 0.03,
  /** Thumb segment directions for the pinch: the pad comes to rest on the card face. */
  thumb: [
    [0.05, 0.74, 0.67],
    [-0.05, 0, 1],
    [-0.05, -0.05, 1],
  ] as Vec3[],
};

/** Empty-handed: wrists rest on the table edge, fingers relaxed. */
const REST: Reach = {
  target: 'body',
  at: [-0.26, 1.5, 0.52],
  finger: [0, -0.25, 1],
  thumb: [1, 0, 0],
  shape: { curl: { Index: 0.3, Middle: 0.35, Ring: 0.4, Pinky: 0.45 }, thumb: 0.15 },
};

const RESTING: Clip = { duration: 1, keys: [{ t: 0, R: REST }] };
const RESTING_LEFT = mirrorClip(RESTING);

const ARM = ['UpperArm', 'LowerArm', 'Hand'];
const DIGIT_BONES = [
  ...FINGERS.flatMap((f) => [1, 2, 3].map((i) => `${f}${i}`)),
  'Thumb1',
  'Thumb2',
  'Thumb3',
];
const mirror = (side: Side, [x, y, z]: Vec3) => V(side === 'R' ? x : -x, y, z);
const ease = (t: number) => t * t * (3 - 2 * t);

export interface ActiveClip {
  clip: Clip;
  /** Milliseconds since the clip started. */
  time: number;
}

export interface PoseInput {
  yaw: number;
  pitch: number;
  reduced: boolean;
  /** Cards held; 0 rests the hands. */
  count: number;
  /** The fan's half-angle as laid out; defaults to the peer layout for `count`. */
  half?: number;
  /** The carry frame the fan is drawn in; defaults to this character's eyes. */
  frame?: THREE.Matrix4;
  clips?: ActiveClip[];
  /** World frames of runtime reach targets such as `table`. */
  targets?: Record<string, THREE.Matrix4>;
}

/** Poses one loaded character: look, grip, then clips blended over the grip. */
export class CharacterPose {
  readonly bones = new Map<string, THREE.Bone>();
  private sockets = new Map<string, THREE.Object3D>();
  private rest = new Map<string, THREE.Vector3>();
  private fold = new Map<string, THREE.Quaternion>();
  private pinch = new Map<string, THREE.Quaternion>();

  constructor(readonly root: THREE.Object3D) {
    root.traverse((node) => {
      if (node instanceof THREE.Bone) {
        this.bones.set(node.name, node);
        this.rest.set(node.name, node.position.clone());
      } else if (node.name.startsWith('Socket')) this.sockets.set(node.name.slice(6), node);
    });
    for (const joint of SKELETON) this.bone(joint.name);
    this.reset();
    // Thumb poses are hand-local, so they are measured once in the bind pose, with
    // directions taken from the character's own frame wherever it stands.
    const toWorld = root.getWorldQuaternion(new THREE.Quaternion());
    const unit = this.scale();
    for (const side of ['L', 'R'] as const) {
      const thumb = [1, 2, 3].map((i) => this.bone(`Thumb${i}${side}`));
      const tip = this.bone(`ThumbTip${side}`);
      const palm = V(side === 'R' ? 1 : -1, 0, 0)
        .applyQuaternion(toWorld)
        .multiplyScalar(unit);
      aim(thumb[0]!, thumb[1]!, world(this.bone(`Ring1${side}`)).addScaledVector(palm, 0.035));
      aim(thumb[1]!, thumb[2]!, world(this.bone(`Pinky1${side}`)).addScaledVector(palm, 0.03));
      aim(thumb[2]!, tip, world(this.bone(`Pinky2${side}`)).addScaledVector(palm, 0.025));
      thumb.forEach((bone) => this.fold.set(bone.name, bone.quaternion.clone()));
      this.reset();
      GRIP.thumb.forEach((direction, i) =>
        aim(
          thumb[i]!,
          thumb[i + 1] ?? tip,
          world(thumb[i]!).add(mirror(side, direction).applyQuaternion(toWorld)),
        ),
      );
      thumb.forEach((bone) => this.pinch.set(bone.name, bone.quaternion.clone()));
      this.reset();
    }
  }

  private bone(name: string) {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Character rig is missing ${name}`);
    return bone;
  }

  socket(name: string) {
    const socket = this.sockets.get(name);
    if (!socket) throw new Error(`Character rig is missing socket ${name}`);
    return socket;
  }

  private scale() {
    return this.root.getWorldScale(V()).x;
  }

  reset() {
    for (const [name, bone] of this.bones) {
      bone.quaternion.identity();
      bone.position.copy(this.rest.get(name)!);
    }
    this.root.updateWorldMatrix(true, true);
  }

  /** Seated look: the torso turns with most of a wide look, the neck supplies the rest. */
  look(yaw: number, pitch: number) {
    this.reset();
    for (const [name, share] of [
      ['Abdomen', 0.4],
      ['Chest', 0.4],
    ] as const) {
      const bone = this.bone(name);
      worldRotation(
        bone,
        new THREE.Quaternion()
          .setFromAxisAngle(V(0, 1, 0), yaw * share)
          .multiply(bone.getWorldQuaternion(new THREE.Quaternion())),
      );
    }
    // Looking up lifts the chest a little, bringing the shoulders toward a raised fan.
    const chest = this.bone('Chest');
    chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -pitch * 0.25));
    this.bone('Head').quaternion.multiply(headLook(yaw * 0.2, pitch * 0.75));
    this.root.updateWorldMatrix(true, true);
  }

  view() {
    const quaternion = this.bone('Head').getWorldQuaternion(new THREE.Quaternion());
    return {
      position: world(this.socket('Eyes')),
      quaternion: quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI)),
    };
  }

  /** Finger and thumb rotations for a hand shape; the hand's own placement is separate. */
  private shape(side: Side, shape: HandShape) {
    const flex = V(0, side === 'R' ? 1 : -1, 0);
    const across = V(1, 0, 0);
    FINGERS.forEach((finger, i) => {
      const curl = shape.curl?.[finger] ?? 0;
      const spread = (shape.spread ?? 0) * [-1, 0, 0.6, 1.2][i]!;
      [1.25, 1.35, 0.8].forEach((amount, j) => {
        const bone = this.bone(`${finger}${j + 1}${side}`);
        bone.quaternion.setFromAxisAngle(flex, curl * amount);
        if (j === 0)
          bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(across, spread));
      });
    });
    const thumb = shape.thumb ?? 0;
    for (let i = 1; i <= 3; i++) {
      const bone = this.bone(`Thumb${i}${side}`);
      bone.quaternion.identity().slerp(this.fold.get(bone.name)!, thumb);
    }
    this.bone(`Hand${side}`).updateWorldMatrix(false, true);
  }

  private gripShape(side: Side) {
    FINGERS.forEach((finger, i) => {
      GRIP.curl.forEach((amount, j) => {
        const bone = this.bone(`${finger}${j + 1}${side}`);
        bone.quaternion.setFromAxisAngle(V(0, side === 'R' ? 1 : -1, 0), amount);
        if (j === 0)
          bone.quaternion.premultiply(
            new THREE.Quaternion().setFromAxisAngle(
              V(1, 0, 0),
              GRIP.spread * [-1, 0, 0.6, 1.2][i]!,
            ),
          );
      });
    });
    for (let i = 1; i <= 3; i++) {
      const bone = this.bone(`Thumb${i}${side}`);
      bone.quaternion.copy(this.pinch.get(bone.name)!);
    }
    this.bone(`Hand${side}`).updateWorldMatrix(false, true);
  }

  /** Place the wrist with the two-bone arm, then set the hand's world rotation. */
  private arm(side: Side, wrist: THREE.Vector3, rotation: THREE.Quaternion) {
    // Reaching far, the collarbone swings the shoulder toward the target before the
    // elbow straightens: a natural reach, with no limb stretched.
    const shoulder = this.bone(`Shoulder${side}`);
    const upper = this.bone(`UpperArm${side}`);
    shoulder.quaternion.identity();
    shoulder.updateWorldMatrix(false, true);
    const length =
      world(upper).distanceTo(world(this.bone(`LowerArm${side}`))) +
      world(this.bone(`LowerArm${side}`)).distanceTo(world(this.bone(`Hand${side}`)));
    const excess = world(upper).distanceTo(wrist) - 0.9 * length;
    if (excess > 0) {
      const pivot = world(shoulder);
      const collar = world(upper).sub(pivot);
      const axis = collar.clone().cross(wrist.clone().sub(pivot)).normalize();
      if (axis.lengthSq() > 0.5) this.turn(shoulder, axis, Math.min(0.5, excess / collar.length()));
    }
    solveLimb(
      this.bone(`UpperArm${side}`),
      this.bone(`LowerArm${side}`),
      this.bone(`Hand${side}`),
      wrist,
      this.root.localToWorld(V(side === 'R' ? -1.15 : 1.15, 1.2, 0.25)),
    );
    worldRotation(this.bone(`Hand${side}`), rotation);
  }

  /** Put `effector` (a point that moves rigidly with the hand) on `target`. */
  private place(
    side: Side,
    rotation: THREE.Quaternion,
    target: THREE.Vector3,
    effector: () => THREE.Vector3,
  ) {
    const hand = this.bone(`Hand${side}`);
    this.arm(side, target.clone(), rotation);
    // The hand is rigid: two corrections land the effector (or reach as far as the arm can).
    for (let i = 0; i < 2; i++)
      this.arm(side, world(hand).add(target.clone().sub(effector())), rotation);
  }

  /** World matrices of the held cards, laid out like the renderer's fan. */
  private fan(frame: THREE.Matrix4, count: number, half: number) {
    const cards = Math.max(1, count);
    const step = cards > 1 ? (2 * half) / (cards - 1) : 0;
    return Array.from({ length: cards }, (_, i) => {
      const card = heldCard(i, cards, step);
      return frame
        .clone()
        .multiply(
          new THREE.Matrix4().compose(
            card.position,
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(Math.PI / 2, 0, -card.angle, 'ZYX'),
            ),
            V(HELD_CARD_SCALE, HELD_CARD_SCALE, HELD_CARD_SCALE),
          ),
        );
    });
  }

  /**
   * How far a point must move back (along the card normal, in world units) to lie behind
   * every card it overlaps. Negative `radius` measures to the front faces instead.
   */
  private clearance(cards: THREE.Matrix4[], point: THREE.Vector3, radius: number, front = false) {
    let need = -Infinity;
    for (const card of cards) {
      const scale = V().setFromMatrixColumn(card, 0).length();
      const local = point.clone().applyMatrix4(card.clone().invert());
      const radiusLocal = radius / scale;
      // Beyond an edge by `outside`, a round finger still meets the card only within the
      // part of its radius that reaches over the edge.
      const outside = Math.hypot(
        Math.max(0, Math.abs(local.x) - CARD_HALF_WIDTH),
        Math.max(0, Math.abs(local.z) - CARD_HALF_HEIGHT),
      );
      if (outside >= radiusLocal) continue;
      const r = Math.sqrt(radiusLocal ** 2 - outside ** 2);
      const surface = bow(local.z);
      // Behind: the point must sit below the back surface; in front: above the face.
      const depth = front
        ? surface + CARD_HALF_THICKNESS + r - local.y
        : local.y - surface + CARD_HALF_THICKNESS + r;
      need = Math.max(need, depth * scale);
    }
    return need;
  }

  /** Thumb pad on the outer card's face, index finger along its back, fingers behind. */
  private grip(side: Side, cards: THREE.Matrix4[], half: number) {
    const card = side === 'R' ? cards.at(-1)! : cards[0]!;
    const outward = side === 'R' ? 1 : -1;
    // Card frame: up toward its top, out of its face, inward toward the fan's centre.
    const up = V(0, 0, -1).transformDirection(card);
    const face = V(0, 1, 0).transformDirection(card);
    const inward = V(-outward, 0, 0).transformDirection(card);
    const lean = Math.min(GRIP.lean[2]!, GRIP.lean[0]! + GRIP.lean[1]! * half);
    const finger = up
      .clone()
      .multiplyScalar(Math.cos(lean))
      .addScaledVector(inward, Math.sin(lean));
    const rotation = handBasis(finger, face);
    this.gripShape(side);
    const corner = V(outward * CARD_HALF_WIDTH, 0, CARD_HALF_HEIGHT).applyMatrix4(card);
    const anchor = mirror(side, GRIP.anchor).multiplyScalar(this.scale()).applyQuaternion(rotation);
    const hand = this.bone(`Hand${side}`);
    this.arm(side, corner.sub(anchor), rotation);
    // Inner cards overlap the outer one near the pivot, each a little further back: the
    // index finger and palm sit behind the deepest card they cover.
    const unit = this.scale();
    let back = 0;
    for (const finger of FINGERS) {
      const radius = HAND.fingerRadius * unit;
      const joints = [1, 2, 3, 'Tip'].map((j) => world(this.bone(`${finger}${j}${side}`)));
      for (let j = 0; j + 1 < joints.length; j++)
        for (const t of [0, 0.5])
          back = Math.max(
            back,
            this.clearance(cards, joints[j]!.clone().lerp(joints[j + 1]!, t), radius * 1.25),
          );
    }
    for (let z = 0.02; z <= 0.17; z += 0.03) {
      const edge = mirror(side, [0, HAND.palmWidth / 2, z]).multiplyScalar(unit);
      back = Math.max(
        back,
        this.clearance(cards, world(hand).add(edge.applyQuaternion(rotation)), 0.004 * unit),
      );
    }
    if (back > 0) this.arm(side, world(hand).addScaledVector(face, -back - 0.001 * unit), rotation);
    this.settleThumb(side, cards, face);
  }

  /** Rotate the thumb at its base until its pad rests on the frontmost face beneath it. */
  private settleThumb(side: Side, cards: THREE.Matrix4[], face: THREE.Vector3) {
    const base = this.bone(`Thumb1${side}`);
    const unit = this.scale();
    // The thumb's two phalanges as tapering tubes, matching the generated skin.
    const joints = [2, 3, 'Tip'].map((j) => this.bone(`Thumb${j}${side}`));
    // Eight-sided rings: the flats sit a little inside the joint radius.
    const radii = [1.05, 0.95, 0.85].map((k) => (k * HAND.thumbRadius * 0.95 + 0.0003) * unit);
    for (let i = 0; i < 4; i++) {
      // The lowest point of the thumb over any card, measured to the frontmost face.
      let lift = -Infinity;
      let lowest = world(this.socket(`Grip${side}`));
      for (let j = 0; j + 1 < joints.length; j++)
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const point = world(joints[j]!).lerp(world(joints[j + 1]!), t);
          const radius = THREE.MathUtils.lerp(radii[j]!, radii[j + 1]!, t);
          const need = this.clearance(cards, point, radius, true);
          if (need > lift) {
            lift = need;
            lowest = point;
          }
        }
      if (!Number.isFinite(lift) || Math.abs(lift) < 1e-5) return;
      // Turning about this axis swings that point along the card normal.
      const lever = lowest.sub(world(base));
      const axis = lever.clone().cross(face).normalize();
      const along = axis.clone().cross(lever).dot(face);
      if (Math.abs(along) < 1e-6) return;
      this.turn(base, axis, lift / along);
    }
  }

  private turn(bone: THREE.Bone, axis: THREE.Vector3, angle: number) {
    worldRotation(
      bone,
      new THREE.Quaternion()
        .setFromAxisAngle(axis, angle)
        .multiply(bone.getWorldQuaternion(new THREE.Quaternion())),
    );
  }

  /** World position, directions and shape of a reach key. */
  private resolve(side: Side, reach: Reach, targets: Record<string, THREE.Matrix4>) {
    let frame: THREE.Matrix4;
    if (reach.target === 'body') frame = this.root.matrixWorld;
    else if (this.sockets.has(reach.target) && reach.target !== 'Grip' + side) {
      const socket = this.socket(reach.target);
      frame = new THREE.Matrix4().compose(
        world(socket),
        this.bone('Head').getWorldQuaternion(new THREE.Quaternion()),
        V(1, 1, 1).multiplyScalar(this.scale()),
      );
    } else {
      const target = targets[reach.target];
      if (!target) return undefined;
      frame = target;
    }
    const rotation = new THREE.Quaternion().setFromRotationMatrix(frame);
    return {
      point: V(...(reach.at ?? [0, 0, 0])).applyMatrix4(frame),
      finger: V(...reach.finger)
        .applyQuaternion(rotation)
        .normalize(),
      thumb: V(...reach.thumb)
        .applyQuaternion(rotation)
        .normalize(),
      effector: reach.effector ?? 'Wrist',
      shape: reach.shape ?? {},
    };
  }

  /** Interpolate a side's reach keys at `time` and solve the arm. */
  private perform(side: Side, clip: Clip, time: number, targets: Record<string, THREE.Matrix4>) {
    const keys = clip.keys.filter((key) => key[side]);
    let next = keys.findIndex((key) => key.t > time);
    if (next < 0) next = keys.length;
    const a = keys[Math.max(0, next - 1)]!;
    const b = keys[Math.min(keys.length - 1, next)]!;
    const s = a === b ? 0 : ease(THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1));
    const from = this.resolve(side, a[side]!, targets);
    const to = this.resolve(side, b[side]!, targets);
    if (!from || !to) return false;
    const shape: HandShape = {
      curl: Object.fromEntries(
        FINGERS.map((f) => [
          f,
          THREE.MathUtils.lerp(from.shape.curl?.[f] ?? 0, to.shape.curl?.[f] ?? 0, s),
        ]),
      ),
      spread: THREE.MathUtils.lerp(from.shape.spread ?? 0, to.shape.spread ?? 0, s),
      thumb: THREE.MathUtils.lerp(from.shape.thumb ?? 0, to.shape.thumb ?? 0, s),
    };
    this.shape(side, shape);
    const rotation = handBasis(from.finger.lerp(to.finger, s), from.thumb.lerp(to.thumb, s));
    const point = from.point.lerp(to.point, s);
    const hand = this.bone(`Hand${side}`);
    const effector = to.effector;
    const offset =
      effector === 'IndexTip'
        ? () => world(this.bone(`IndexTip${side}`))
        : effector === 'Palm'
          ? () => world(this.socket(`Palm${side}`))
          : () => world(hand);
    this.place(side, rotation, point, offset);
    return true;
  }

  /** Additive spine/head rotations of a clip at `time`. */
  private additive(clip: Clip, time: number) {
    const keys = clip.keys.filter((key) => key.bones);
    const result = new Map<string, THREE.Quaternion>();
    if (!keys.length) return result;
    let next = keys.findIndex((key) => key.t > time);
    if (next < 0) next = keys.length;
    const a = keys[Math.max(0, next - 1)]!;
    const b = keys[Math.min(keys.length - 1, next)]!;
    const s = a === b ? 0 : ease(THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1));
    for (const name of new Set([...Object.keys(a.bones!), ...Object.keys(b.bones!)])) {
      const qa = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...(a.bones![name] ?? [0, 0, 0])),
      );
      const qb = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...(b.bones![name] ?? [0, 0, 0])),
      );
      result.set(name, qa.slerp(qb, s));
    }
    return result;
  }

  /** Full pose for a frame; returns whether anything is still moving. */
  pose(input: PoseInput) {
    this.look(input.yaw, input.pitch);
    const frame = input.frame ?? carryMatrix(this.view(), undefined, this.scale());
    const half = input.half ?? fanHalfAngle(Math.min(7, input.count));
    const cards = input.count > 0 ? this.fan(frame, input.count, half) : [];
    for (const side of ['L', 'R'] as const) {
      // A single card is held in the right hand; two hands would meet over it.
      if (holds(side, input.count)) this.grip(side, cards, half);
      else this.perform(side, side === 'R' ? RESTING : RESTING_LEFT, 0, {});
    }
    let moving = false;
    for (const { clip, time } of input.clips ?? []) {
      const weight = clipWeight(clip, time, input.reduced);
      if (!weight) continue;
      moving ||= !input.reduced;
      const at = input.reduced ? (clip.peak ?? clip.duration / 2) : time;
      const names = sidesOf(clip).flatMap((side) =>
        [...ARM, ...DIGIT_BONES].map((name) => `${name}${side}`),
      );
      const base = new Map(names.map((name) => [name, this.bone(name).quaternion.clone()]));
      const solved = sidesOf(clip).filter((side) => {
        for (const name of [...ARM, ...DIGIT_BONES])
          this.bone(`${name}${side}`).quaternion.identity();
        this.root.updateWorldMatrix(true, true);
        return this.perform(side, clip, at, input.targets ?? {});
      });
      for (const name of names) {
        const bone = this.bone(name);
        const target = bone.quaternion.clone();
        const solvedSide = solved.some((side) => name.endsWith(side));
        bone.quaternion.copy(base.get(name)!);
        if (solvedSide) bone.quaternion.slerp(target, weight);
      }
      for (const [name, rotation] of this.additive(clip, at)) {
        const bone = this.bone(name);
        bone.quaternion.multiply(new THREE.Quaternion().slerp(rotation, weight));
      }
      this.root.updateWorldMatrix(true, true);
    }
    this.root.updateWorldMatrix(true, true);
    return moving;
  }
}

/** Which hands hold the fan: both for two or more cards, the right alone for one. */
export const holds = (side: Side, count: number) => count > 1 || (count === 1 && side === 'R');
