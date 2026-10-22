import * as THREE from 'three';

/**
 * The Durak character contract. Any character GLB (generated or artist-made) that
 * provides these bones, sockets and proportions works with the runtime unchanged.
 *
 * Units are normalized character units; the table renders characters at
 * CHARACTER_SCALE. The bind pose is seated, facing +Z, with the character's left
 * on +X. Every bone's bind rotation is the identity, so clip rotations are
 * expressed in world-aligned joint frames.
 */

export type Side = 'L' | 'R';
export const SIDES: readonly Side[] = ['L', 'R'];
export const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;
export const DIGITS = ['Thumb', ...FINGERS] as const;
export type Finger = (typeof FINGERS)[number];
export type Digit = (typeof DIGITS)[number];

/** Held card height and width in character units (fan card 1.2 x 0.82, scaled 0.8 x 0.3 / 1.6). */
export const CARD_HEIGHT = 0.18;
export const CARD_WIDTH = 0.123;

/** Hand proportions, sized to the held card so a thumb-and-finger pinch fits it. */
export const HAND = {
  /** Wrist to middle knuckle: about one card height. */
  palm: 0.17,
  palmWidth: 0.12,
  palmThickness: 0.05,
  /** Segment lengths: proximal, middle, distal. */
  fingers: {
    Index: [0.068, 0.042, 0.034],
    Middle: [0.074, 0.046, 0.036],
    Ring: [0.068, 0.043, 0.034],
    Pinky: [0.054, 0.034, 0.029],
  } satisfies Record<Finger, number[]>,
  fingerRadius: 0.0155,
  /** Metacarpal, proximal, distal. The metacarpal lets the thumb oppose the palm. */
  thumb: [0.058, 0.044, 0.036],
  thumbRadius: 0.0175,
} as const;

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
  const wrist: [number, number, number] = [-0.36, 1.72, 0.5];
  const joints: Joint[] = [
    { name: s('Shoulder'), parent: 'Chest', at: p(-0.08, 2.05, 0.1) },
    { name: s('UpperArm'), parent: s('Shoulder'), at: p(-0.29, 2.08, 0.1) },
    { name: s('LowerArm'), parent: s('UpperArm'), at: p(-0.36, 1.72, 0.1) },
    { name: s('Hand'), parent: s('LowerArm'), at: p(...wrist) },
    { name: s('UpperLeg'), parent: 'Hips', at: p(-0.2, 1.1, 0.1) },
    { name: s('LowerLeg'), parent: s('UpperLeg'), at: p(-0.2, 0.85, 0.62) },
    { name: s('Foot'), parent: s('LowerLeg'), at: p(-0.2, -0.25, 0.72) },
    { name: s('Toe'), parent: s('Foot'), at: p(-0.2, -0.3, 0.92) },
  ];
  // The hand points forward (+Z), palm toward the body's midline, thumb up.
  const knuckles: Record<Finger, [number, number]> = {
    Index: [0.045, 0.17],
    Middle: [0.015, 0.175],
    Ring: [-0.016, 0.168],
    Pinky: [-0.045, 0.155],
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
    [0.45, 0.45, 0.77],
    [0.3, 0.35, 0.89],
    [0.2, 0.3, 0.93],
  ];
  let at: [number, number, number] = [wrist[0] + 0.012, wrist[1] + 0.012, wrist[2] + 0.025];
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

/** Every joint in parent-before-child order, with seated bind positions. */
export const SKELETON: readonly Joint[] = [
  { name: 'Root', parent: '', at: [0, 0, 0] },
  { name: 'Hips', parent: 'Root', at: [0, 1.05, 0.1] },
  { name: 'Abdomen', parent: 'Hips', at: [0, 1.25, 0.09] },
  { name: 'Chest', parent: 'Abdomen', at: [0, 1.7, 0.08] },
  { name: 'Neck', parent: 'Chest', at: [0, 2.235, 0.083] },
  { name: 'Head', parent: 'Neck', at: [0, 2.383, 0.083] },
  { name: 'HeadTop', parent: 'Head', at: [0, 2.9, 0.083] },
  ...limbs('R'),
  ...limbs('L'),
];

/**
 * Named attachment points, as offsets in their bone's bind frame. Face sockets keep
 * the landmarks the camera and gestures already use, so the seated eye position and
 * card carry frame do not move.
 */
export const SOCKETS: Readonly<Record<string, { bone: string; at: [number, number, number] }>> = {
  Eyes: { bone: 'Head', at: [0, 0.2106, 0.1947] },
  Nose: { bone: 'Head', at: [0, 0.111, 0.254] },
  EarL: { bone: 'Head', at: [0.204, 0.205, 0.058] },
  EarR: { bone: 'Head', at: [-0.204, 0.205, 0.058] },
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
