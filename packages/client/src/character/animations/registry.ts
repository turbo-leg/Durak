import { GESTURE_DURATION_MS } from '@durak/shared';
import { mirrorClip, type Clip, type HandShape } from '../animation.ts';
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
