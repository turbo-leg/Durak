import * as THREE from 'three';
import {
  clipWeight,
  mirrorClip,
  REST,
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
  /** One hand holds the fan by the lower corner of its outer card: the palm side of the
   * index knuckle sits here, from the card's bottom centre (outward, up), in carry units. */
  at: [0, 0.5] as [number, number],
  /** Fingers point across behind the fan's base: radians from the card's upright, inward. */
  angle: 1.5,
  /** Fingertips recede behind the cards. */
  pitch: 0.4,
  /** Fingers wrap the back of the fan: curl at each joint, and a slight fan. */
  curl: [0.45, 0.6, 0.4],
  spread: 0.04,
  /** Thumb segment directions; the pad then settles on the front card's face. */
  thumb: [
    [0.8, 0.5, 0.4],
    [0.35, 0.4, 0.85],
    [0.1, 0.3, 0.95],
  ] as Vec3[],
};

const RESTING: Clip = { duration: 1, keys: [{ t: 0, R: REST }] };
const RESTING_LEFT = mirrorClip(RESTING);

const ARM = ['Shoulder', 'UpperArm', 'LowerArm', 'Hand'];
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
  /** World frames of this clip's runtime targets, such as the slot a card is played to. */
  targets?: Record<string, THREE.Matrix4>;
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
  /** Shoulder rotation from emotes (a shrug, a sob); reaching starts from here. */
  private shoulders = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };

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
    this.shoulders.L.identity();
    this.shoulders.R.identity();
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
    shoulder.quaternion.copy(this.shoulders[side]);
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
      // Elbows bend outward and down, as a seated person's do.
      this.root.localToWorld(V(side === 'R' ? -0.56 : 0.56, 0.58, 0.12)),
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

  /**
   * One hand holds the fan by its outer card's lower corner: thumb pad on the face,
   * fingers wrapped behind. `slide` moves the whole grip down the card (and `aside` times
   * as far outward), so a hand can arrive or leave from below the fan, clear of every card.
   */
  private grip(side: Side, cards: THREE.Matrix4[], frame: THREE.Matrix4, slide = 0, aside = 0) {
    const outward = side === 'R' ? 1 : -1;
    // The hand holds the lower corner of the outer card, so the grip follows the fan as it
    // widens: the right hand's card is the front one, the left hand's the back one.
    const card = side === 'R' ? cards.at(-1)! : cards[0]!;
    const unit = V().setFromMatrixColumn(frame, 0).length();
    const up = V(0, 0, -1).transformDirection(card);
    const face = V(0, 0, 1).transformDirection(frame);
    const inward = V(-outward, 0, 0).transformDirection(card);
    const finger = up
      .clone()
      .multiplyScalar(Math.cos(GRIP.angle))
      .addScaledVector(inward, Math.sin(GRIP.angle))
      .multiplyScalar(Math.cos(GRIP.pitch))
      .addScaledVector(face, -Math.sin(GRIP.pitch))
      .normalize();
    // The palm faces the card backs; the thumb side follows from the hand's chirality.
    const thumbSide = side === 'R' ? finger.clone().cross(face) : face.clone().cross(finger);
    const rotation = handBasis(finger, thumbSide);
    this.gripShape(side);
    const base = V(0, 0, CARD_HALF_HEIGHT)
      .applyMatrix4(card)
      .addScaledVector(inward, -GRIP.at[0] * unit)
      .addScaledVector(up, GRIP.at[1] * unit);
    const knuckle = mirror(side, [HAND.palmThickness / 2, 0.045, HAND.palm])
      .multiplyScalar(this.scale())
      .applyQuaternion(rotation);
    const hand = this.bone(`Hand${side}`);
    this.arm(side, base.sub(knuckle), rotation);
    // Every card meets at the base, each a little further back: fingers and palm sit
    // behind the deepest card they cover.
    const scale = this.scale();
    let back = 0;
    for (const digit of FINGERS) {
      const radius = HAND.fingerRadius * scale;
      const joints = [1, 2, 3, 'Tip'].map((j) => world(this.bone(`${digit}${j}${side}`)));
      for (let j = 0; j + 1 < joints.length; j++)
        for (const t of [0, 0.5])
          back = Math.max(
            back,
            this.clearance(cards, joints[j]!.clone().lerp(joints[j + 1]!, t), radius * 1.25),
          );
    }
    // The palm's surface and its edges.
    for (let z = 0.02; z <= 0.17; z += 0.03)
      for (const [x, y] of [
        [HAND.palmThickness / 2, -0.04],
        [HAND.palmThickness / 2, 0],
        [HAND.palmThickness / 2, 0.04],
        [0, HAND.palmWidth / 2],
        [0, -HAND.palmWidth / 2],
      ] as const) {
        const point = mirror(side, [x, y, z]).multiplyScalar(scale).applyQuaternion(rotation);
        back = Math.max(back, this.clearance(cards, world(hand).add(point), 0.003 * scale));
      }
    if (back > 0)
      this.arm(side, world(hand).addScaledVector(face, -back - 0.0005 * scale), rotation);
    // The whole thumb turns at its base, then the knuckle and tip joint flex until the
    // pad itself, not just the thicker base, rests on the face.
    for (const joint of [1, 2, 3]) this.settleThumb(side, cards, face, joint);
    if (slide > 0)
      this.arm(
        side,
        world(hand)
          .addScaledVector(up, -slide)
          .addScaledVector(inward, -slide * aside),
        rotation,
      );
  }

  /** Rotate the thumb at its base until its pad rests on the frontmost face beneath it. */
  private settleThumb(side: Side, cards: THREE.Matrix4[], face: THREE.Vector3, from = 1) {
    const base = this.bone(`Thumb${from}${side}`);
    const unit = this.scale();
    // The thumb from joint `from` to its tip, as tapering tubes matching the generated skin
    // (from the metacarpal, the base of the web, when `from` is 1).
    const joints = [1, 2, 3, 'Tip'].slice(from - 1).map((j) => this.bone(`Thumb${j}${side}`));
    // Eight-sided rings: the flats sit a little inside the joint radius.
    const radii = [1.25, 1.05, 0.95, 0.85]
      .slice(from - 1)
      .map((k) => (k * HAND.thumbRadius * 0.95 + 0.0006) * unit);
    for (let i = 0; i < 12; i++) {
      // The lowest point of the thumb over any card, measured to the frontmost face.
      let lift = -Infinity;
      let lowest = world(this.socket(`Grip${side}`));
      for (let j = 0; j + 1 < joints.length; j++)
        for (const t of j === 0 && from === 1
          ? [0.5, 0.625, 0.75, 0.875]
          : [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
          const point = world(joints[j]!).lerp(world(joints[j + 1]!), t);
          let radius = THREE.MathUtils.lerp(radii[j]!, radii[j + 1]!, t);
          // The skin's tube stops short of the tip and closes with a rounded cap, so near
          // the tip the surface sits closer to the axis.
          if (j + 2 === joints.length) {
            const length = world(joints[j]!).distanceTo(world(joints[j + 1]!));
            const beyond = t * length - (length - 0.7 * HAND.thumbRadius * unit);
            if (beyond > 0) radius = Math.sqrt(Math.max(0, radius ** 2 - beyond ** 2));
          }
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
    const point = this.within(side, from.point.lerp(to.point, s), to.effector);
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

  /**
   * A target beyond the arm's reach is approached along the same line, stopping with the
   * elbow nearly straight: the card is tossed the rest of the way.
   */
  private within(side: Side, point: THREE.Vector3, effector: string) {
    const upper = world(this.bone(`UpperArm${side}`));
    const lower = world(this.bone(`LowerArm${side}`));
    const length =
      upper.distanceTo(lower) +
      lower.distanceTo(world(this.bone(`Hand${side}`))) +
      (effector === 'Wrist' ? 0 : HAND.palm * (effector === 'Palm' ? 0.5 : 1.8) * this.scale());
    const offset = point.clone().sub(upper);
    const limit = 0.95 * length;
    return offset.length() > limit ? upper.add(offset.setLength(limit)) : point;
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
    const active = (input.clips ?? [])
      .map((entry) => ({ ...entry, weight: clipWeight(entry.clip, entry.time, input.reduced) }))
      .filter((entry) => entry.weight > 0)
      .map((entry) => ({
        ...entry,
        at: input.reduced ? (entry.clip.peak ?? entry.clip.duration / 2) : entry.time,
      }));
    // The spine and head lean first, so both hands are then placed from the leaning body.
    for (const { clip, at, weight } of active)
      for (const [name, rotation] of this.additive(clip, at)) {
        const bone = this.bone(name);
        bone.quaternion.multiply(new THREE.Quaternion().slerp(rotation, weight));
      }
    this.shoulders.L.copy(this.bone('ShoulderL').quaternion);
    this.shoulders.R.copy(this.bone('ShoulderR').quaternion);
    this.root.updateWorldMatrix(true, true);
    // The right hand holds the fan; while a clip needs it, the left takes the fan over,
    // blending in with that clip so the cards are never let go.
    const needs = (side: Side) =>
      Math.max(
        0,
        ...active.filter(({ clip }) => sidesOf(clip).includes(side)).map((a) => a.weight),
      );
    const holder = holdingHand(input.count, needs('R') > 0, needs('L') > 0);
    for (const side of ['L', 'R'] as const) {
      this.perform(side, side === 'R' ? RESTING : RESTING_LEFT, 0, {});
      // A right hand lending the fan to the left returns into its grip from below.
      if (side === 'R' && holder === 'L')
        this.grip(side, cards, frame, Math.min(1, needs('R') / 0.25) * 0.17 * this.scale(), 1);
      if (side !== holder) continue;
      const blend = side === 'L' ? needs('R') : 1;
      const names = [...ARM, ...DIGIT_BONES].map((name) => `${name}${side}`);
      const resting = names.map((name) => this.bone(name).quaternion.clone());
      // A hand taking the fan over first comes to just below it, then slides up into the
      // grip with its thumb already in front: the cards pass between thumb and fingers.
      this.grip(side, cards, frame, (1 - blend) * 0.17 * this.scale());
      const approach = Math.min(1, blend * 2.5);
      if (approach < 1)
        names.forEach((name, i) => {
          const bone = this.bone(name);
          bone.quaternion.copy(resting[i]!.slerp(bone.quaternion, approach));
        });
      this.root.updateWorldMatrix(true, true);
    }
    let moving = false;
    for (const { clip, at, weight, targets } of active) {
      moving ||= !input.reduced;
      const names = sidesOf(clip).flatMap((side) =>
        [...ARM, ...DIGIT_BONES].map((name) => `${name}${side}`),
      );
      const base = new Map(names.map((name) => [name, this.bone(name).quaternion.clone()]));
      const solved = sidesOf(clip).filter((side) => {
        for (const name of [...ARM, ...DIGIT_BONES])
          this.bone(`${name}${side}`).quaternion.identity();
        this.bone(`Shoulder${side}`).quaternion.copy(this.shoulders[side]);
        this.root.updateWorldMatrix(true, true);
        return this.perform(side, clip, at, { ...input.targets, ...targets });
      });
      for (const name of names) {
        const bone = this.bone(name);
        const target = bone.quaternion.clone();
        const solvedSide = solved.some((side) => name.endsWith(side));
        bone.quaternion.copy(base.get(name)!);
        // A right hand leaving the fan first slides clear of it, then turns to the clip.
        const lending = name.endsWith('R') && holder === 'L';
        const share = lending ? THREE.MathUtils.clamp((weight - 0.25) / 0.75, 0, 1) : weight;
        if (solvedSide) bone.quaternion.slerp(target, share);
      }
      this.root.updateWorldMatrix(true, true);
    }
    this.root.updateWorldMatrix(true, true);
    return moving;
  }
}

/** The hand holding the fan: the right, unless a clip is using it; none for no cards. */
export function holdingHand(count: number, rightBusy = false, leftBusy = false): Side | undefined {
  if (count === 0) return undefined;
  if (!rightBusy) return 'R';
  return leftBusy ? undefined : 'L';
}
