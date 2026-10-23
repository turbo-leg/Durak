import * as THREE from 'three';

/**
 * The Durak character contract. Any character GLB (generated or artist-made) that
 * provides these bones, sockets and proportions works with the runtime unchanged.
 *
 * Units are metres (the glTF convention), sized to an average adult of 172 cm; the table
 * renders characters at CHARACTER_SCALE world units per metre. The bind pose is seated on
 * a 45 cm chair with the floor at y = 0, facing +Z, with the character's left on +X.
 * Every bone's bind rotation is the identity, so clip rotations are expressed in
 * world-aligned joint frames.
 */

export type Side = 'L' | 'R';
export const SIDES: readonly Side[] = ['L', 'R'];
export const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;
export const DIGITS = ['Thumb', ...FINGERS] as const;
export type Finger = (typeof FINGERS)[number];
export type Digit = (typeof DIGITS)[number];

/** A standard poker-size playing card, 63.5 x 88.9 mm. */
export const REAL_CARD = { height: 0.0889, width: 0.0635 } as const;
/**
 * The game's cards are jumbo cards, half again a real card's size, so their faces read on
 * a screen. Held, flying and table cards all share this one size.
 */
export const CARD_SIZE = 1.5;
export const CARD_HEIGHT = REAL_CARD.height * CARD_SIZE;
export const CARD_WIDTH = REAL_CARD.width * CARD_SIZE;

/** Seated adult anthropometrics (metres), averages of adult men and women. */
export const BODY = {
  stature: 1.72,
  seat: 0.45,
  /** Seated eye height above the seat. */
  eyesAboveSeat: 0.76,
  shoulderWidth: 0.38,
  upperArm: 0.33,
  forearm: 0.26,
  thigh: 0.43,
  shin: 0.42,
} as const;

/** Real hand proportions: 19 cm long, the palm a little longer than a card. */
export const HAND = {
  /** Wrist to middle knuckle. */
  palm: 0.108,
  palmWidth: 0.085,
  palmThickness: 0.03,
  /** Segment lengths: proximal, middle, distal (to the fingertip). */
  fingers: {
    Index: [0.036, 0.022, 0.019],
    Middle: [0.04, 0.025, 0.021],
    Ring: [0.037, 0.024, 0.02],
    Pinky: [0.029, 0.017, 0.017],
  } satisfies Record<Finger, number[]>,
  fingerRadius: 0.0085,
  /** Metacarpal, proximal, distal. The metacarpal lets the thumb climb in front of a card
   * and oppose the index finger. */
  thumb: [0.046, 0.032, 0.026],
  thumbRadius: 0.0105,
} as const;

/** The skull, as an ellipsoid relative to the Head joint (the top of the neck). */
export const SKULL = {
  centre: [0, 0.075, 0.012] as [number, number, number],
  /** Half width, half height (chin to crown 23 cm), half depth. */
  radii: [0.077, 0.115, 0.098] as [number, number, number],
};

type Joint = { name: string; parent: string; at: [number, number, number] };

const mirror = (side: Side, [x, y, z]: [number, number, number]): [number, number, number] => [
  side === 'R' ? x : -x,
  y,
  z,
];

/** Right-side bind positions (character's right is -X); the left mirrors them. */
function limbs(side: Side): Joint[] {
  const s = (name: string) => `${name}${side}`;
  const p = (x: number, y: number, z: number) => mirror(side, [x, y, z]);
  // Upper arm hangs; the forearm reaches forward toward the table.
  const shoulder = [-BODY.shoulderWidth / 2, 1.04, -0.01] as const;
  const elbow = [-0.21, shoulder[1] - BODY.upperArm, 0] as const;
  const wrist: [number, number, number] = [elbow[0], elbow[1] + 0.01, BODY.forearm];
  const knee = [-0.1, 0.48, 0.45] as const;
  const joints: Joint[] = [
    { name: s('Shoulder'), parent: 'Chest', at: p(-0.02, 1.02, 0.03) },
    { name: s('UpperArm'), parent: s('Shoulder'), at: p(...shoulder) },
    { name: s('LowerArm'), parent: s('UpperArm'), at: p(...elbow) },
    { name: s('Hand'), parent: s('LowerArm'), at: p(...wrist) },
    { name: s('UpperLeg'), parent: 'Hips', at: p(-0.09, 0.53, 0.02) },
    { name: s('LowerLeg'), parent: s('UpperLeg'), at: p(...knee) },
    { name: s('Foot'), parent: s('LowerLeg'), at: p(-0.11, 0.07, 0.5) },
    { name: s('Toe'), parent: s('Foot'), at: p(-0.11, 0.02, 0.68) },
  ];
  // The hand points forward (+Z), palm toward the body's midline, thumb up.
  const knuckles: Record<Finger, [number, number]> = {
    Index: [0.03, 0.1],
    Middle: [0.01, HAND.palm],
    Ring: [-0.012, 0.1],
    Pinky: [-0.032, 0.092],
  };
  for (const finger of FINGERS) {
    const [height, reach] = knuckles[finger];
    let z = wrist[2] + reach;
    let parent = s('Hand');
    HAND.fingers[finger].forEach((length, i) => {
      const name = s(`${finger}${i + 1}`);
      joints.push({ name, parent, at: p(wrist[0], wrist[1] + height, z) });
      parent = name;
      z += length;
    });
    joints.push({ name: s(`${finger}Tip`), parent, at: p(wrist[0], wrist[1] + height, z) });
  }
  // The thumb leaves the wrist forward, up and toward the palm side (+X on the right).
  const thumbDirections: [number, number, number][] = [
    [0.55, 0.22, 0.8],
    [0.35, 0.12, 0.93],
    [0.2, 0.08, 0.98],
  ];
  // The metacarpal starts at the radial (thumb-side) edge of the wrist.
  let at: [number, number, number] = [wrist[0] + 0.006, wrist[1] + 0.024, wrist[2] + 0.012];
  let parent = s('Hand');
  HAND.thumb.forEach((length, i) => {
    const name = s(`Thumb${i + 1}`);
    joints.push({ name, parent, at: p(...at) });
    const d = new THREE.Vector3(...thumbDirections[i]!).normalize().multiplyScalar(length);
    at = [at[0] + d.x, at[1] + d.y, at[2] + d.z];
    parent = name;
  });
  joints.push({ name: s('ThumbTip'), parent, at: p(...at) });
  return joints;
}

/** Head joint at the top of the neck (the atlas), level with the base of the nose. */
const HEAD: [number, number, number] = [0, BODY.seat + BODY.eyesAboveSeat - 0.075, 0];

/** Every joint in parent-before-child order, with seated bind positions. */
export const SKELETON: readonly Joint[] = [
  { name: 'Root', parent: '', at: [0, 0, 0] },
  { name: 'Hips', parent: 'Root', at: [0, 0.54, 0] },
  { name: 'Abdomen', parent: 'Hips', at: [0, 0.65, -0.01] },
  { name: 'Chest', parent: 'Abdomen', at: [0, 0.86, -0.01] },
  { name: 'Neck', parent: 'Chest', at: [0, 1.06, -0.02] },
  { name: 'Head', parent: 'Neck', at: HEAD },
  { name: 'HeadTop', parent: 'Head', at: [0, HEAD[1] + 0.19, 0.01] },
  ...limbs('R'),
  ...limbs('L'),
];

/**
 * Named attachment points, as offsets in their bone's bind frame. `Eyes` is the midpoint
 * between the eyes, where the seated camera sits.
 */
export const SOCKETS: Readonly<Record<string, { bone: string; at: [number, number, number] }>> = {
  Eyes: { bone: 'Head', at: [0, 0.075, 0.095] },
  Nose: { bone: 'Head', at: [0, 0.04, 0.122] },
  EarL: { bone: 'Head', at: [0.078, 0.065, -0.002] },
  EarR: { bone: 'Head', at: [-0.078, 0.065, -0.002] },
  GripR: { bone: 'Thumb3R', at: thumbPad('R') },
  GripL: { bone: 'Thumb3L', at: thumbPad('L') },
  // Centre of the palm surface, where a carried card rests.
  PalmR: { bone: 'HandR', at: [HAND.palmThickness / 2, 0, HAND.palm / 2] },
  PalmL: { bone: 'HandL', at: [-HAND.palmThickness / 2, 0, HAND.palm / 2] },
};

/** The thumb pad: halfway along the distal segment, on the side facing the index finger. */
function thumbPad(side: Side): [number, number, number] {
  const start = new THREE.Vector3(...joint(`Thumb3${side}`).at);
  const end = new THREE.Vector3(...joint(`ThumbTip${side}`).at);
  const along = end.clone().sub(start).normalize();
  const middle = start.clone().lerp(end, 0.5);
  const toward = new THREE.Vector3(...joint(`Index2${side}`).at).sub(middle);
  toward.addScaledVector(along, -toward.dot(along)).normalize();
  return middle.addScaledVector(toward, HAND.thumbRadius).sub(start).toArray();
}

/** Clip ids the runtime looks for; emotes are `emote/<id>`. */
export const CLIPS = ['idle', 'grip', 'play', 'pickup', 'draw'] as const;

export function joint(name: string) {
  const found = SKELETON.find((j) => j.name === name);
  if (!found) throw new Error(`Character skeleton has no ${name}`);
  return found;
}

export function bindPosition(name: string) {
  return new THREE.Vector3(...joint(name).at);
}
