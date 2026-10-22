import { GESTURE_DURATION_MS } from '@durak/shared';
import { mirrorClip, type Clip, type HandShape, type Reach, type Vec3 } from '../animation.ts';
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
        at: [-0.44, 2.16, 0.46],
        finger: [0, 1, 0],
        thumb: [1, 0, 0],
        shape: { ...extended(fingers), spread: 0.08 },
      },
    },
  ],
});

/** The right index fingertip on a face socket; the hand turns with the head. */
const touch = (
  socket: string,
  finger: [number, number, number],
  thumb: [number, number, number],
): Clip => ({
  duration: GESTURE_DURATION_MS,
  keys: [
    {
      t: 0,
      R: { target: socket, effector: 'IndexTip', finger, thumb, shape: extended(1) },
    },
  ],
});

const earRight = touch('EarR', [0.7, 0.75, -0.4], [0.85, -0.62, 0.32]);

export const EMOTES: Readonly<Record<string, Clip>> = {
  one: count(1),
  two: count(2),
  three: count(3),
  four: count(4),
  nose: touch('Nose', [0, 0.88, -0.47], [1, 0, 0]),
  'ear-right': earRight,
  'ear-left': mirrorClip(earRight),
};

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
  at: [-0.22, 1.82, 0.5],
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

/** Reach out and lay a card on its slot, leaning in a little. */
const play: Clip = {
  duration: 900,
  fade: 200,
  peak: 450,
  keys: [
    { t: 150, R: onTable('table', [0, 0.3, 0], flat) },
    { t: 450, R: onTable('table', [0, 0.04, 0], flat), bones: { Chest: [0.1, 0, 0] } },
    { t: 700, R: onTable('table', [0, 0.25, 0], flat) },
    { t: 900, bones: { Chest: [0, 0, 0] } },
  ],
};

/** Sweep the table's cards together and draw them in. */
const pickup: Clip = {
  duration: 1200,
  fade: 220,
  peak: 550,
  keys: [
    { t: 250, R: onTable('table', [0.25, 0.05, 0], flat), bones: { Chest: [0.12, 0, 0] } },
    { t: 550, R: onTable('table', [-0.2, 0.05, 0], gathering) },
    { t: 900, R: toChest, bones: { Chest: [0, 0, 0] } },
  ],
};

/** Take the top card from the deck and bring it to the chest. */
const draw: Clip = {
  duration: 1000,
  fade: 200,
  peak: 400,
  keys: [
    { t: 250, R: onTable('deck', [0, 0.12, 0], flat) },
    { t: 450, R: onTable('deck', [0, 0.06, 0], gathering), bones: { Chest: [0.08, 0, 0] } },
    { t: 800, R: toChest, bones: { Chest: [0, 0, 0] } },
  ],
};

export type ActionId = 'play' | 'pickup' | 'draw';
/** Each action for the right hand, and mirrored for the left. */
export const ACTIONS: Readonly<Record<ActionId, { R: Clip; L: Clip }>> = {
  play: { R: play, L: mirrorClip(play) },
  pickup: { R: pickup, L: mirrorClip(pickup) },
  draw: { R: draw, L: mirrorClip(draw) },
};
