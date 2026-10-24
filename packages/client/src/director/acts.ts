import { mirrorClip, REST, type Clip, type Reach, type Vec3 } from '../character/animation.ts';

/**
 * Scripted performances for promo scenes only: never sent to the server, so they are free to be
 * broad. Hand acts are written for the right hand and mirrored to the free left while the right
 * holds cards, as the public emotes are.
 */

const fist = { curl: { Index: 1, Middle: 1, Ring: 1, Pinky: 1 }, thumb: 1 };
const pointing = { curl: { Index: 0, Middle: 1, Ring: 1, Pinky: 1 }, thumb: 0.8 };
const relaxed = { curl: { Index: 0.35, Middle: 0.4, Ring: 0.45, Pinky: 0.5 }, thumb: 0.3 };
const still = { Head: [0, 0, 0] as Vec3, Neck: [0, 0, 0] as Vec3, Chest: [0, 0, 0] as Vec3 };

/** The head nods twice: yes. */
const nod: Clip = {
  duration: 1300,
  fade: 150,
  peak: 350,
  keys: [0, 250, 500, 750, 1000].map((t, i) => ({
    t,
    bones: { Head: [i % 2 ? 0.24 : 0.02, 0, 0] as Vec3, Neck: [i % 2 ? 0.06 : 0, 0, 0] as Vec3 },
    face: { smile: 0.45, brows: 0.25 },
  })),
};

/** The head shakes: no. */
const no: Clip = {
  duration: 1500,
  fade: 150,
  peak: 400,
  keys: [0, 220, 440, 660, 880, 1100].map((t, i) => ({
    t,
    bones: { Head: [0.04, i === 0 ? 0 : i % 2 ? 0.32 : -0.32, 0] as Vec3 },
    face: { smile: -0.4, brows: -0.35, worry: -0.2 },
  })),
};

/** Shoulders shaking with laughter, head thrown back, eyes screwed up. */
const laugh: Clip = {
  duration: 2400,
  fade: 200,
  peak: 600,
  keys: Array.from({ length: 13 }, (_, i) => ({
    t: i * 180,
    bones: {
      Chest: [i % 2 ? -0.1 : -0.03, 0, 0] as Vec3,
      Head: [i % 2 ? -0.22 : -0.14, 0, 0] as Vec3,
      ShoulderR: [0, 0, i % 2 ? -0.08 : 0] as Vec3,
      ShoulderL: [0, 0, i % 2 ? 0.08 : 0] as Vec3,
    },
    face: { smile: 1, squint: 0.65, brows: 0.4, open: i % 2 ? 0.95 : 0.55 },
  })),
};

/** The palm over the brow, the head sinking into it. */
const brow = (drop: number): Reach => ({
  target: 'Eyes',
  at: [0, 0.035 - drop, 0.05],
  effector: 'Palm',
  finger: [0.3, 0.9, -0.1],
  thumb: [-0.9, 0.35, 0],
  shape: relaxed,
});
const facepalm: Clip = {
  duration: 2200,
  fade: 250,
  peak: 800,
  keys: [
    { t: 0, R: REST, bones: still },
    { t: 350, R: brow(0) },
    { t: 700, R: brow(0.01), bones: { Head: [0.3, 0, 0], Neck: [0.1, 0, 0], Chest: [0.08, 0, 0] } },
    {
      t: 1700,
      R: brow(0.015),
      bones: { Head: [0.34, 0, 0], Neck: [0.12, 0, 0], Chest: [0.1, 0, 0] },
    },
    { t: 2200, R: REST, bones: still },
    { t: 0, face: { smile: -0.5, worry: 0.7, squint: 0.85 } },
  ],
};

/** The chin resting on a loose fist, eyes rolled up in thought. */
const chin: Reach = {
  target: 'Nose',
  at: [0, -0.085, 0.035],
  effector: 'Palm',
  finger: [0.3, 0.9, -0.1],
  thumb: [-0.9, 0.35, 0],
  shape: { curl: { Index: 0.75, Middle: 0.8, Ring: 0.85, Pinky: 0.9 }, thumb: 0.5 },
};
const think: Clip = {
  duration: 2600,
  fade: 300,
  peak: 1000,
  keys: [
    { t: 0, R: REST, bones: still },
    { t: 450, R: chin, bones: { Head: [-0.06, -0.12, 0.12], Neck: [0, 0, 0.04] } },
    { t: 2100, R: chin, bones: { Head: [-0.08, -0.14, 0.14], Neck: [0, 0, 0.05] } },
    { t: 2600, R: REST, bones: still },
    { t: 0, face: { gazeX: 0.6, gazeY: 0.8, brows: -0.25, smile: -0.15 } },
    { t: 1300, face: { gazeX: 0.3, gazeY: 0.9, brows: -0.35, smile: -0.2 } },
  ],
};

/** Recoiling: leaning back, jaw dropped, brows shot up. */
const shock: Clip = {
  duration: 1700,
  fade: 120,
  peak: 300,
  keys: [
    {
      t: 0,
      bones: {
        Chest: [-0.3, 0, 0],
        Head: [-0.22, 0, 0],
        Neck: [-0.08, 0, 0],
        ShoulderR: [0, 0, -0.28],
        ShoulderL: [0, 0, 0.28],
      },
      face: { open: 1, brows: 1, worry: 0.4, smile: -0.2 },
    },
  ],
};

/** Nodding off: the head drops, eyes shut, mouth falls open, jerks up once. */
const sleep: Clip = {
  duration: 3200,
  fade: 400,
  peak: 1500,
  keys: [
    {
      t: 0,
      bones: { Head: [0.15, 0, 0.05], Neck: [0.05, 0, 0] },
      face: { squint: 0.7, open: 0.1 },
    },
    { t: 900, bones: { Head: [0.5, 0, 0.18], Neck: [0.18, 0, 0] }, face: { squint: 1, open: 0.4 } },
    {
      t: 2100,
      bones: { Head: [0.55, 0, 0.2], Neck: [0.2, 0, 0] },
      face: { squint: 1, open: 0.45 },
    },
    // Startled awake.
    {
      t: 2400,
      bones: { Head: [-0.08, 0, 0], Neck: [0, 0, 0] },
      face: { squint: 0, open: 0.3, brows: 1 },
    },
    { t: 3200, bones: { Head: [0, 0, 0], Neck: [0, 0, 0] }, face: { brows: 0.4 } },
  ],
};

/** Leaning over to sneak a look at a neighbour's cards. `side` 1 is the character's left. */
const peek = (side: 1 | -1): Clip => ({
  duration: 2400,
  fade: 350,
  peak: 1000,
  keys: [
    { t: 0, bones: still },
    {
      t: 600,
      bones: { Chest: [0.12, side * 0.25, side * -0.18], Head: [0.1, side * 0.45, side * -0.1] },
      face: { squint: 0.35, brows: -0.3, smile: 0.25, gazeX: side },
    },
    {
      t: 1800,
      bones: { Chest: [0.12, side * 0.28, side * -0.2], Head: [0.12, side * 0.5, side * -0.1] },
      face: { squint: 0.4, brows: -0.35, smile: 0.35, gazeX: side },
    },
    { t: 2400, bones: still, face: { gazeX: 0 } },
  ],
});

/** A fist raised and slammed on the table, face like thunder. */
const raised: Reach = {
  target: 'body',
  at: [-0.2, 1.12, 0.28],
  finger: [0, 1, 0.3],
  thumb: [1, 0, 0],
  shape: fist,
};
const struck: Reach = {
  target: 'body',
  at: [-0.2, 0.8, 0.42],
  finger: [0, 0.2, 1],
  thumb: [0.3, 1, 0],
  shape: fist,
};
const slam: Clip = {
  duration: 1400,
  fade: 120,
  peak: 420,
  keys: [
    { t: 0, R: REST },
    { t: 300, R: raised, bones: { Chest: [-0.06, 0, 0] } },
    { t: 420, R: struck, bones: { Chest: [0.14, 0, 0], Head: [0.1, 0, 0] } },
    { t: 1000, R: struck, bones: { Chest: [0.1, 0, 0] } },
    { t: 1400, R: REST, bones: { Chest: [0, 0, 0] } },
    { t: 0, face: { brows: -1, worry: -1, smile: -0.7, open: 0.35, squint: 0.3 } },
  ],
};

/** An arm out across the table, index finger pointing: "you!" */
const aim: Reach = {
  target: 'body',
  at: [-0.1, 1.1, 0.46],
  finger: [0.12, 0.02, 1],
  thumb: [0.1, 1, 0],
  shape: pointing,
};
const point: Clip = {
  duration: 1900,
  fade: 200,
  peak: 600,
  keys: [
    { t: 0, R: REST, bones: still },
    { t: 350, R: aim, bones: { Chest: [0.08, 0, 0] } },
    { t: 1500, R: aim, bones: { Chest: [0.1, 0, 0] } },
    { t: 1900, R: REST, bones: still },
    { t: 0, face: { brows: 0.6, smile: 0.35, open: 0.35 } },
  ],
};

export const ACTS: Readonly<Record<string, Clip>> = {
  nod,
  no,
  laugh,
  facepalm,
  think,
  shock,
  sleep,
  'peek-left': peek(1),
  'peek-right': peek(-1),
  slam,
  point,
};

const HANDED = new Set(['facepalm', 'think', 'slam', 'point']);
const mirrored = Object.fromEntries([...HANDED].map((id) => [id, mirrorClip(ACTS[id]!)])) as Record<
  string,
  Clip
>;

/** An act's clip; a hand act uses the free left hand while the right holds cards. */
export const actClip = (id: string, holding: boolean) => (holding && mirrored[id]) || ACTS[id]!;

/**
 * Lips moving with speech: the jaw opens on each vowel and closes between words, from the
 * mouth shapes the voice script works out (`[ms, open]` pairs from the line's start).
 */
export function talkClip(mouth: readonly (readonly [number, number])[]): Clip {
  const end = mouth.length ? mouth[mouth.length - 1]![0] + 120 : 200;
  return {
    duration: end,
    fade: 60,
    keys: [
      { t: 0, face: { open: 0 } },
      ...mouth.map(([t, open]) => ({ t, face: { open, brows: 0.15 * open } })),
      { t: end, face: { open: 0 } },
    ],
  };
}
