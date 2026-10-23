import * as THREE from 'three';
import {
  clipWeight,
  mirrorClip,
  ASIDE,
  BEHIND,
  EXPRESSION,
  REST,
  sidesOf,
  track,
  type Clip,
  type Expression,
  type HandShape,
  type Reach,
  type Vec3,
} from './animation.ts';
import { aim, handBasis, solveLimb, world, worldRotation } from './ik.ts';
import { FACE, FINGERS, HAND, LID_TRAVEL, SIDES, SKELETON, type Side } from './spec.ts';
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
  pitch: 0.7,
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

/** Resting: on the table's edge (time 0), let down by the side (1), leaning back (2). */
const RESTING: Clip = {
  duration: 2,
  keys: [
    { t: 0, R: REST },
    { t: 1, R: ASIDE },
    { t: 2, R: BEHIND },
  ],
};
const RESTING_LEFT = mirrorClip(RESTING);

const ARM = ['Shoulder', 'UpperArm', 'LowerArm', 'Hand'];
const DIGIT_BONES = [
  ...FINGERS.flatMap((f) => [1, 2, 3].map((i) => `${f}${i}`)),
  'Thumb1',
  'Thumb2',
  'Thumb3',
];
const mirror = (side: Side, [x, y, z]: Vec3) => V(side === 'R' ? x : -x, y, z);

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
  /** The body's own motion; see `look`. */
  motion?: BodyMotion;
  /** The table the character sits at: the shortest world-space move that brings a ball at
   * `point` clear of it (zero when clear). Free hands rest on it, never in it. */
  table?: (point: THREE.Vector3, radius: number) => THREE.Vector3;
  /** Where the eyes look beyond the head's turn (radians): they lead a look the head is
   * still turning toward. */
  gaze?: { yaw: number; pitch: number };
  /** An expression added to the clips' own, such as a preview's. */
  face?: Expression;
}

export interface BodyMotion {
  /** Milliseconds on a free-running clock: the body breathes and settles while seated. */
  time?: number;
  /** Where the torso has turned so far; it follows the head's `yaw` a little behind. */
  torso?: number;
}

const TAU = Math.PI * 2;
/** A repeatable random number in [0, 1) for step `n` of stream `k`. */
const noise = (n: number, k: number) => {
  const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Poses one loaded character: look, grip, then clips blended over the grip. */
export class CharacterPose {
  readonly bones = new Map<string, THREE.Bone>();
  private sockets = new Map<string, THREE.Object3D>();
  private rest = new Map<string, THREE.Vector3>();
  private fold = new Map<string, THREE.Quaternion>();
  private pinch = new Map<string, THREE.Quaternion>();
  /** Shoulder rotation from emotes (a shrug, a sob); reaching starts from here. */
  private shoulders = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
  /** Each body breathes and sways on its own rhythm (seconds into the cycle). */
  private readonly phase = Math.random() * 60;
  /** How far the last pose raised the fan (world units, straight up) so the hand holding
   * it stays above the table; whoever draws the cards raises them as far. */
  fanLift = 0;

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

  /**
   * Seated look: the torso turns with most of a wide look (following at `motion.torso`)
   * and the neck supplies the rest, so the eyes always face `yaw`. Given a clock, the body
   * also breathes, sways a little and the head drifts, as a person sitting still does.
   */
  look(yaw: number, pitch: number, motion: BodyMotion = {}) {
    this.reset();
    const torso = motion.torso ?? yaw;
    for (const [name, share] of [
      ['Abdomen', 0.4],
      ['Chest', 0.4],
    ] as const) {
      const bone = this.bone(name);
      worldRotation(
        bone,
        new THREE.Quaternion()
          .setFromAxisAngle(V(0, 1, 0), torso * share)
          .multiply(bone.getWorldQuaternion(new THREE.Quaternion())),
      );
    }
    if (motion.time !== undefined) this.breathe(motion.time / 1000 + this.phase);
    // Looking up lifts the chest a little, bringing the shoulders toward a raised fan.
    const chest = this.bone('Chest');
    chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -pitch * 0.25));
    this.bone('Head').quaternion.multiply(headLook(yaw - 0.8 * torso, pitch * 0.75));
    this.root.updateWorldMatrix(true, true);
  }

  /** Small idle motions at `t` seconds: breath in the chest and shoulders, sway, head drift. */
  private breathe(t: number) {
    const wave = (period: number, offset = 0) => Math.sin((TAU * t) / period + offset);
    // About fourteen breaths a minute; the chest rises and the shoulders lift on the inhale.
    const breath = wave(4.3);
    const add = (name: string, x: number, y: number, z: number) =>
      this.bone(name).quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)),
      );
    add('Abdomen', 0.006 * breath, 0.012 * wave(7.7, 1), 0.008 * wave(11.3, 2));
    add('Chest', -0.014 * breath, 0.006 * wave(9.1, 3), 0);
    const lift = 0.018 * Math.max(0, breath);
    add('ShoulderL', 0, 0, lift);
    add('ShoulderR', 0, 0, -lift);
    add(
      'Head',
      0.012 * wave(3.1, 2) + 0.005 * wave(1.7),
      0.016 * wave(5.3, 0.5),
      0.008 * wave(6.7, 4),
    );
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
        for (const t of [0, 0.5, 1])
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
    // Frames carry the character's world scale; only their rotation turns the directions.
    const rotation = new THREE.Quaternion();
    frame.decompose(V(), rotation, V());
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

  /** Follow a side's reach keys through `time` and solve the arm. */
  private perform(side: Side, clip: Clip, time: number, targets: Record<string, THREE.Matrix4>) {
    const keys = clip.keys.filter((key) => key[side]);
    const reaches = keys.map((key) => this.resolve(side, key[side]!, targets));
    if (reaches.some((reach) => !reach)) return false;
    const resolved = reaches as NonNullable<(typeof reaches)[number]>[];
    // Position, finger and thumb directions and hand shape travel together on one track.
    const [x, y, z, fx, fy, fz, tx, ty, tz, spread, fold, ...curl] = track(
      keys.map((key) => key.t),
      resolved.map(({ point, finger, thumb, shape }) => [
        ...point.toArray(),
        ...finger.toArray(),
        ...thumb.toArray(),
        shape.spread ?? 0,
        shape.thumb ?? 0,
        ...FINGERS.map((f) => shape.curl?.[f] ?? 0),
      ]),
      time,
    ) as number[];
    this.shape(side, {
      curl: Object.fromEntries(FINGERS.map((f, i) => [f, curl[i]!])),
      spread,
      thumb: fold,
    });
    const rotation = handBasis(V(fx, fy, fz).normalize(), V(tx, ty, tz).normalize());
    // Keys may place different parts of the hand (wrist, palm, fingertip): across a stretch
    // the placed point slides from one to the next, so the hand never jumps at a key.
    let next = keys.findIndex((key) => key.t > time);
    if (next < 0) next = keys.length - 1;
    const previous = Math.max(0, next - 1);
    const span = keys[next]!.t - keys[previous]!.t;
    const share = span > 0 ? THREE.MathUtils.smoothstep(time, keys[previous]!.t, keys[next]!.t) : 1;
    const part = (effector: string) =>
      effector === 'IndexTip'
        ? world(this.bone(`IndexTip${side}`))
        : effector === 'Palm'
          ? world(this.socket(`Palm${side}`))
          : world(this.bone(`Hand${side}`));
    const [from, to] = [resolved[previous]!.effector, resolved[next]!.effector];
    const point = this.within(side, V(x, y, z), to);
    this.place(side, rotation, point, () =>
      from === to ? part(to) : part(from).lerp(part(to), share),
    );
    return true;
  }

  /**
   * A target beyond the arm's reach is approached at its own height, stopping with the
   * elbow nearly straight: the hand stays low over the table (under a held fan) and the
   * card is tossed the rest of the way. Too far below, it is approached along the line.
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
    if (offset.length() <= limit) return point;
    const up = V(0, 1, 0);
    const drop = offset.dot(up);
    const across = offset.clone().addScaledVector(up, -drop);
    if (Math.abs(drop) >= limit || across.lengthSq() < 1e-8)
      return upper.add(offset.setLength(limit));
    return upper.add(across.setLength(Math.sqrt(limit ** 2 - drop ** 2))).addScaledVector(up, drop);
  }

  /** Additive spine/head rotations of a clip at `time`, smooth through every key. */
  private additive(clip: Clip, time: number) {
    const keys = clip.keys.filter((key) => key.bones);
    const result = new Map<string, THREE.Quaternion>();
    for (const name of new Set(keys.flatMap((key) => Object.keys(key.bones!)))) {
      const [x, y, z] = track(
        keys.map((key) => key.t),
        keys.map((key) => key.bones![name] ?? [0, 0, 0]),
        time,
      );
      result.set(name, new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
    }
    return result;
  }

  /** Full pose for a frame; returns whether anything is still moving. */
  pose(input: PoseInput) {
    this.look(input.yaw, input.pitch, input.motion);
    let frame = input.frame ?? carryMatrix(this.view(), undefined, this.scale());
    const half = input.half ?? fanHalfAngle(Math.min(7, input.count));
    let cards = input.count > 0 ? this.fan(frame, input.count, half) : [];
    this.fanLift = 0;
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
      // Looking down, or toward a free hand, brings the fan down over that hand's place on
      // the table: the arm lets down beside the hip, out of its way.
      const toward = Math.max(0, side === 'L' ? input.yaw : -input.yaw);
      const aside =
        input.count > 0 ? THREE.MathUtils.smoothstep(0.4 * toward - input.pitch, 0.05, 0.3) : 0;
      const behind = THREE.MathUtils.smoothstep(toward, 0.5, 0.85);
      this.perform(side, side === 'R' ? RESTING : RESTING_LEFT, aside * (1 + behind), {});
      if (input.table) this.clearTable(side, input.table);
      // A right hand lending the fan to the left returns into its grip from below.
      if (side === 'R' && holder === 'L')
        this.grip(side, cards, frame, Math.min(1, needs('R') / 0.25) * 0.17 * this.scale(), 1);
      if (side !== holder) continue;
      const blend = side === 'L' ? needs('R') : 1;
      const names = [...ARM, ...DIGIT_BONES].map((name) => `${name}${side}`);
      const resting = names.map((name) => this.bone(name).quaternion.clone());
      // Held low over the table, the fan is raised until the hand that grips it clears it.
      if (input.table) {
        this.grip(side, cards, frame);
        const lift = this.fanClearance(side, input.table, cards, frame, input.count, half);
        if (lift > 0) {
          this.fanLift = lift;
          frame = new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(frame);
          cards = this.fan(frame, input.count, half);
        }
      }
      // A hand taking the fan over first comes to just below it, then slides up into the
      // grip with its thumb already in front: the cards pass between thumb and fingers.
      this.grip(side, cards, frame, (1 - blend) * 0.17 * this.scale());
      const approach = Math.min(1, blend * 2.5);
      if (approach < 1) {
        names.forEach((name, i) => {
          const bone = this.bone(name);
          bone.quaternion.copy(resting[i]!.slerp(bone.quaternion, approach));
        });
        // On its way up from the table the hand is not yet holding anything.
        this.root.updateWorldMatrix(true, true);
        if (input.table) this.clearTable(side, input.table);
      }
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
    if (input.table)
      for (const side of ['L', 'R'] as const)
        if (side !== holder) this.clearTable(side, input.table);
    // A blink is quick: while one is under way the frame keeps full pace.
    const blinking = this.express(input, active);
    this.root.updateWorldMatrix(true, true);
    return moving || blinking;
  }

  /**
   * The face: the clips' expressions, weighted as they blend, over a living rest. Given a
   * clock, the lids blink every few seconds, the eyes make small darting looks and lead
   * the head into a turn; a face at rest wears the faintest smile.
   */
  private express(input: PoseInput, active: { clip: Clip; at: number; weight: number }[]) {
    if (!this.bones.has('Jaw')) return false;
    const face = Object.fromEntries(EXPRESSION.map((name) => [name, input.face?.[name] ?? 0]));
    face.smile! += 0.12;
    for (const { clip, at, weight } of active) {
      const keys = clip.keys.filter((key) => key.face);
      if (!keys.length) continue;
      const values = track(
        keys.map((key) => key.t),
        keys.map((key) => EXPRESSION.map((name) => key.face![name] ?? 0)),
        at,
      );
      EXPRESSION.forEach((name, i) => (face[name]! += values[i]! * weight));
    }
    let blink = 0;
    if (input.motion?.time !== undefined) {
      const t = input.motion.time / 1000 + this.phase;
      blink = this.blink(t);
      // A new fixation every second or so: the eyes settle on it in a quick 60 ms hop.
      const glance = (n: number) => [noise(n, 1) - 0.5, noise(n, 2) - 0.5];
      const n = Math.floor(t / 1.3);
      const hop = THREE.MathUtils.smoothstep(t - n * 1.3, 0, 0.06);
      const [x0, y0] = glance(n - 1);
      const [x1, y1] = glance(n);
      face.gazeX! += 0.35 * THREE.MathUtils.lerp(x0!, x1!, hop);
      face.gazeY! += 0.25 * THREE.MathUtils.lerp(y0!, y1!, hop);
    }
    if (input.gaze) {
      face.gazeX! += input.gaze.yaw / 0.5;
      face.gazeY! += input.gaze.pitch / 0.4;
    }
    const clamp = (value: number, low = -1) => THREE.MathUtils.clamp(value, low, 1);
    const [rx, ry, rz] = FACE.eyeRadii;
    const dx = clamp(face.gazeX!) * rx * 0.4;
    const dy = clamp(face.gazeY!) * ry * 0.35;
    // The iris keeps to the eyeball's curved surface as it turns.
    const dz = rz * (Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2 - (dy / ry) ** 2)) - 1);
    // Looking down lowers the lids a little, as real lids follow the eye.
    const lowered = Math.min(1, clamp(face.squint!, 0) + Math.max(0, -clamp(face.gazeY!)) * 0.2);
    const closed = 1 - (1 - blink) * (1 - lowered);
    for (const side of SIDES) {
      const out = side === 'L' ? 1 : -1;
      this.bone(`Eye${side}`).position.add(V(dx, dy, dz));
      this.bone(`Lid${side}`).quaternion.setFromAxisAngle(V(1, 0, 0), LID_TRAVEL * closed);
      const brow = this.bone(`Brow${side}`);
      brow.position.y += 0.004 * clamp(face.brows!);
      brow.quaternion.setFromAxisAngle(V(0, 0, 1), -out * 0.3 * clamp(face.worry!));
      const corner = this.bone(`Mouth${side}`);
      corner.position.y += 0.0045 * clamp(face.smile!);
      corner.position.x += out * 0.0015 * clamp(face.smile!, 0);
    }
    this.bone('Jaw').quaternion.setFromAxisAngle(V(1, 0, 0), 0.22 * clamp(face.open!, 0));
    return blink > 0;
  }

  /** How closed a blink holds the lids at `t` seconds: one every two to six seconds, now
   * and then two in quick succession; each shuts fast and opens a little slower. */
  private blink(t: number) {
    const PERIOD = 4;
    const shut = (dt: number) =>
      dt < 0 || dt > 0.2
        ? 0
        : dt < 0.07
          ? THREE.MathUtils.smoothstep(dt, 0, 0.07)
          : 1 - THREE.MathUtils.smoothstep(dt, 0.07, 0.2);
    let closed = 0;
    for (const n of [Math.floor(t / PERIOD) - 1, Math.floor(t / PERIOD)]) {
      const at = n * PERIOD + noise(n, 3) * 2.6;
      closed = Math.max(closed, shut(t - at), noise(n, 4) > 0.75 ? shut(t - at - 0.3) : 0);
    }
    return closed;
  }

  /** Balls (world centre and radius) covering a hand and its forearm, as the skin is built. */
  private handVolume(side: Side) {
    const unit = this.scale();
    const hand = this.bone(`Hand${side}`);
    const elbow = world(this.bone(`LowerArm${side}`));
    const wrist = world(hand);
    const rotation = hand.getWorldQuaternion(new THREE.Quaternion());
    const balls: [THREE.Vector3, number][] = [0.4, 0.7, 1].map((t) => [
      elbow.clone().lerp(wrist, t),
      THREE.MathUtils.lerp(0.037, 0.026, t) * unit,
    ]);
    for (let z = 0.02; z <= 0.11; z += 0.03)
      for (const [x, y] of [
        [HAND.palmThickness / 2, 0],
        [-HAND.palmThickness / 2, 0],
        [0, HAND.palmWidth / 2],
        [0, -HAND.palmWidth / 2],
      ] as const)
        balls.push([
          mirror(side, [x, y, z]).multiplyScalar(unit).applyQuaternion(rotation).add(wrist),
          0.006 * unit,
        ]);
    for (const digit of [...FINGERS, 'Thumb'])
      for (const joint of [1, 2, 3, 'Tip'])
        balls.push([
          world(this.bone(`${digit}${joint}${side}`)),
          (digit === 'Thumb' ? HAND.thumbRadius : HAND.fingerRadius) * unit,
        ]);
    return balls;
  }

  /** The deepest part of a hand in the table: its shortest way out (zero when clear). */
  private tableDepth(side: Side, table: NonNullable<PoseInput['table']>) {
    const margin = 0.002 * this.scale();
    let push = V();
    for (const [point, radius] of this.handVolume(side)) {
      const move = table(point, radius + margin);
      if (move.lengthSq() > push.lengthSq()) push = move;
    }
    return push;
  }

  /** How far straight up a gripped fan must rise for its hand to clear the table. The
   * hand is left gripping the raised fan. */
  private fanClearance(
    side: Side,
    table: NonNullable<PoseInput['table']>,
    cards: THREE.Matrix4[],
    frame: THREE.Matrix4,
    count: number,
    half: number,
  ) {
    let lift = 0;
    for (let i = 0; i < 4; i++) {
      const push = this.tableDepth(side, table);
      if (push.length() < 0.0005 * this.scale()) break;
      // Rising frees a hand from the top at once, or from under the rail's edge at last.
      lift += Math.max(push.y, push.length());
      const raised = new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(frame);
      cards = this.fan(raised, count, half);
      this.grip(side, cards, raised);
    }
    return lift;
  }

  /**
   * A free hand meeting the table comes to rest on it: the whole hand (keeping its turn and
   * shape) moves up onto the surface, or back off the edge, by the deepest part's shortest way out.
   */
  private clearTable(side: Side, table: NonNullable<PoseInput['table']>) {
    const hand = this.bone(`Hand${side}`);
    const rotation = hand.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 4; i++) {
      const push = this.tableDepth(side, table);
      if (push.length() < 0.0005 * this.scale()) return;
      this.arm(side, world(hand).add(push), rotation);
      this.root.updateWorldMatrix(true, true);
    }
  }
}

/** The hand holding the fan: the right, unless a clip is using it; none for no cards. */
export function holdingHand(count: number, rightBusy = false, leftBusy = false): Side | undefined {
  if (count === 0) return undefined;
  if (!rightBusy) return 'R';
  return leftBusy ? undefined : 'L';
}
