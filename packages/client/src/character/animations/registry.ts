import { GESTURE_DURATION_MS } from '@durak/shared';
import {
  mirrorClip,
  REST,
  type Clip,
  type HandShape,
  type Reach,
  type Vec3,
} from '../animation.ts';
import { FINGERS } from '../spec.ts';

/**
 * Every emote a character can perform, keyed by its public gesture id. To add one:
 * write a clip (reach targets in body or socket frames, a hand shape, optional spine
 * and head rotations) and add it here. The shared GESTURES list must name the id so
 * the server accepts it; a test keeps the two in step.
 */

const extended = (count: number): HandShape => ({
  curl: Object.fromEntries(FINGERS.map((finger, i) => [finger, i < count ? 0 : 1])),
  thumb: 1,
});

/** Raise the right hand beside the head, palm toward the table, and show a count. */
const count = (fingers: number): Clip => ({
  duration: GESTURE_DURATION_MS,
  keys: [
    {
      t: 0,
      R: {
        target: 'body',
        at: [-0.22, 1.25, 0.22],
        finger: [0, 1, 0],
        thumb: [1, 0, 0],
        shape: { ...extended(fingers), spread: 0.08 },
      },
    },
  ],
});

/**
 * The right index fingertip on a face socket; the hand turns with the head. It arrives
 * around the fan, via its own shoulder and then `approach` (metres in the head's frame, beside the ear or
 * the face), and leaves the same way, so the hand passes neither the fan nor the face.
 */
/** Waypoints out of the way of the held fan wherever the head turns it: low and out to the
 * side, then raised beside the shoulder. */
const BELOW_FAN: Reach = {
  target: 'body',
  at: [-0.34, 0.7, -0.03],
  effector: 'IndexTip',
  finger: [0, -0.4, 1],
  thumb: [1, 0, 0],
  shape: extended(1),
};
const BESIDE_SHOULDER = {
  target: 'body',
  at: [-0.3, 1.02, 0.08] as Vec3,
  effector: 'IndexTip' as const,
  shape: extended(1),
};

const touch = (
  socket: string,
  finger: [number, number, number],
  thumb: [number, number, number],
  approach: [number, number, number],
): Clip => ({
  duration: GESTURE_DURATION_MS,
  keys: [
    { t: 0, R: REST },
    { t: 250, R: BELOW_FAN },
    { t: 450, R: { ...BESIDE_SHOULDER, finger, thumb } },
    {
      t: 600,
      R: { target: socket, at: approach, effector: 'IndexTip', finger, thumb, shape: extended(1) },
    },
    {
      t: 750,
      R: { target: socket, effector: 'IndexTip', finger, thumb, shape: extended(1) },
    },
    {
      t: GESTURE_DURATION_MS - 750,
      R: { target: socket, effector: 'IndexTip', finger, thumb, shape: extended(1) },
    },
    {
      t: GESTURE_DURATION_MS - 600,
      R: { target: socket, at: approach, effector: 'IndexTip', finger, thumb, shape: extended(1) },
    },
    { t: GESTURE_DURATION_MS - 450, R: { ...BESIDE_SHOULDER, finger, thumb } },
    { t: GESTURE_DURATION_MS - 250, R: BELOW_FAN },
    { t: GESTURE_DURATION_MS, R: REST },
  ],
});

const earRight = touch('EarR', [0.7, 0.75, -0.4], [0.85, -0.62, 0.32], [-0.07, -0.02, 0.02]);

/** The right palm over the eyes, rubbing; the head bows and the chest sobs. */
const coverEyes = (x: number): Reach => ({
  target: 'Eyes',
  at: [x, -0.005, 0.045],
  effector: 'Palm',
  // Fingers up across the brow, palm toward the face, thumb out to the side.
  finger: [0.35, 0.9, -0.1],
  thumb: [-0.9, 0.4, 0],
  shape: { curl: { Index: 0.35, Middle: 0.4, Ring: 0.45, Pinky: 0.5 }, thumb: 0.3 },
});
const sob = (t: number, deep: boolean) => ({
  t,
  bones: {
    Neck: [0.12, 0, 0] as Vec3,
    Head: [0.28, 0, 0] as Vec3,
    Chest: [deep ? 0.18 : 0.1, 0, 0] as Vec3,
    ShoulderR: [0, 0, deep ? -0.07 : 0] as Vec3,
    ShoulderL: [0, 0, deep ? 0.07 : 0] as Vec3,
  },
});
const cry: Clip = {
  duration: GESTURE_DURATION_MS,
  fade: 300,
  peak: 900,
  keys: [
    { t: 0, R: coverEyes(-0.02) },
    { t: 700, R: coverEyes(-0.01) },
    { t: 1000, R: coverEyes(-0.025) },
    { t: 1300, R: coverEyes(-0.01) },
    ...[0, 250, 450, 650, 850, 1050, 1250, 1450, 1650].map((t, i) => sob(t, i % 2 === 1)),
  ],
};

/** A fist pumped above the shoulder, leaning back a little. */
const pump = (height: number): Reach => ({
  target: 'body',
  at: [-0.16, height, 0.13],
  finger: [0.1, 1, 0.1],
  thumb: [1, 0, 0.2],
  shape: { curl: { Index: 1, Middle: 1, Ring: 1, Pinky: 1 }, thumb: 1 },
});
const cheer: Clip = {
  duration: GESTURE_DURATION_MS,
  peak: 400,
  keys: [0, 400, 650, 900, 1150, 1400].map((t, i) => ({
    t,
    R: pump(i % 2 ? 1.46 : 1.38),
    bones: { Chest: [-0.06, 0, 0] as Vec3, Head: [-0.1, 0, 0] as Vec3 },
  })),
};

/** Shoulders up, the free palm turned up and out, head tilted. */
const shrug: Clip = {
  duration: GESTURE_DURATION_MS,
  peak: 700,
  keys: [
    {
      t: 0,
      R: {
        target: 'body',
        at: [-0.22, 0.9, 0.2],
        finger: [-0.5, 0.1, 1],
        thumb: [-0.89, 0, -0.45],
        shape: { curl: { Index: 0.1, Middle: 0.15, Ring: 0.2, Pinky: 0.25 } },
      },
      bones: { ShoulderR: [0, 0, -0.2], ShoulderL: [0, 0, 0.2], Head: [0, 0, 0.12] },
    },
  ],
};

/** Both arms raised: only for a winner, whose hands are free of cards. */
const raised = mirrorClip(cheer);
const victory: Clip = {
  ...cheer,
  duration: 2600,
  keys: cheer.keys.map((key, i) => ({ ...key, L: raised.keys[i]!.L })),
};

export const EMOTES: Readonly<Record<string, Clip>> = {
  one: count(1),
  two: count(2),
  three: count(3),
  four: count(4),
  nose: touch('Nose', [0, 0.88, -0.47], [1, 0, 0], [-0.18, -0.06, 0.06]),
  'ear-right': earRight,
  'ear-left': mirrorClip(earRight),
  cry,
  cheer,
  shrug,
};

/** Emotes that mean the same with either hand: performed by the left while the right holds
 * the fan. Touching a particular ear needs that ear's hand, so those are not mirrored. */
export const FREE_HAND_EMOTES: Readonly<Record<string, Clip>> = Object.fromEntries(
  ['one', 'two', 'three', 'four', 'nose', 'cry', 'cheer', 'shrug'].map((id) => [
    id,
    mirrorClip(EMOTES[id]!),
  ]),
);

/** Played locally when the public game ends: the durak cries, winners celebrate. */
export type ReactionId = 'cry' | 'victory';
export const REACTIONS: Readonly<Record<ReactionId, Clip>> = { cry, victory };

/**
 * Card actions, triggered by public table events. The renderer supplies the `table`
 * (the card's slot) and `deck` targets in the seat's facing frame; anything beyond
 * the arm's reach is approached along the same line and the card travels on alone.
 */
const PALM_DOWN = { finger: [0, -0.35, 1] as Vec3, thumb: [1, 0, 0] as Vec3 };
const flat: HandShape = {
  curl: { Index: 0.15, Middle: 0.15, Ring: 0.2, Pinky: 0.25 },
  thumb: 0.2,
};
const gathering: HandShape = {
  curl: { Index: 0.6, Middle: 0.65, Ring: 0.7, Pinky: 0.75 },
  thumb: 0.5,
};
const toChest: Reach = {
  target: 'body',
  at: [-0.11, 0.95, 0.24],
  effector: 'Palm',
  finger: [0.4, 0.3, 1],
  thumb: [0.4, 1, 0],
  shape: gathering,
};
const onTable = (target: string, at: Vec3, shape: HandShape): Reach => ({
  target,
  at,
  effector: 'Palm',
  ...PALM_DOWN,
  shape,
});

/** The hand lifted off the table's edge, starting toward the table: an arc, not a slide. */
const lift = (shape: HandShape): Reach => ({
  target: 'body',
  at: [-0.19, 0.8, 0.5],
  effector: 'Palm',
  ...PALM_DOWN,
  shape,
});
/** Fingers and thumb pinched on a carried card. */
const holding: HandShape = {
  curl: { Index: 0.3, Middle: 0.35, Ring: 0.45, Pinky: 0.5 },
  thumb: 0.45,
};

/**
 * Lift a card from the resting hand, carry it over its slot and set it down, leaning in;
 * the card rides in the hand until it is let go (`PLAY_RELEASE_MS`).
 */
const play: Clip = {
  duration: 1050,
  fade: 160,
  peak: 560,
  keys: [
    { t: 0, R: REST, bones: { Chest: [0, 0, 0] } },
    { t: 200, R: lift(holding) },
    { t: 420, R: onTable('table', [0, 0.05, 0], holding), bones: { Chest: [0.06, 0, 0] } },
    { t: 560, R: onTable('table', [0, 0.025, 0], flat), bones: { Chest: [0.1, 0, 0] } },
    { t: 740, R: onTable('table', [0.02, 0.055, -0.03], flat), bones: { Chest: [0.04, 0, 0] } },
    { t: 1050, R: REST, bones: { Chest: [0, 0, 0] } },
  ],
};
export const PLAY_RELEASE_MS = 540;

/** Reach past the pile, sweep its cards together toward the body and draw them in. */
const pickup: Clip = {
  duration: 1350,
  fade: 180,
  peak: 600,
  keys: [
    { t: 0, R: REST, bones: { Chest: [0, 0, 0] } },
    { t: 220, R: lift(flat) },
    { t: 450, R: onTable('table', [0.13, 0.045, 0], flat), bones: { Chest: [0.1, 0, 0] } },
    { t: 600, R: onTable('table', [0.12, 0.025, 0], flat), bones: { Chest: [0.12, 0, 0] } },
    { t: 850, R: onTable('table', [-0.1, 0.025, 0], gathering), bones: { Chest: [0.08, 0, 0] } },
    { t: 1100, R: toChest, bones: { Chest: [0, 0, 0] } },
    { t: 1350, R: REST },
  ],
};

/** Reach to the deck, take the top card and draw it back in low, under the fan. */
const draw: Clip = {
  duration: 1150,
  fade: 180,
  peak: 450,
  keys: [
    { t: 0, R: REST, bones: { Chest: [0, 0, 0] } },
    { t: 200, R: lift(flat) },
    { t: 380, R: onTable('deck', [0, 0.05, 0], flat), bones: { Chest: [0.05, 0, 0] } },
    { t: 520, R: onTable('deck', [0, 0.03, 0], gathering), bones: { Chest: [0.08, 0, 0] } },
    { t: 820, R: { ...lift(gathering), at: [-0.19, 0.8, 0.4] }, bones: { Chest: [0, 0, 0] } },
    { t: 1150, R: REST },
  ],
};

export type ActionId = 'play' | 'pickup' | 'draw';
/** Each action for the right hand, and mirrored for the left. */
export const ACTIONS: Readonly<Record<ActionId, { R: Clip; L: Clip }>> = {
  play: { R: play, L: mirrorClip(play) },
  pickup: { R: pickup, L: mirrorClip(pickup) },
  draw: { R: draw, L: mirrorClip(draw) },
};
