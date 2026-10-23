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
      // A friendly count: brows up, a small smile.
      face: { smile: 0.35, brows: 0.3 },
    },
  ],
});

/** A hand on its way up: fingers loosely curled, the index just starting to lead. */
const rising: HandShape = {
  curl: { Index: 0.25, Middle: 0.6, Ring: 0.7, Pinky: 0.75 },
  thumb: 0.55,
};

interface Touch {
  /** The face socket the index fingertip touches; the hand turns with the head. */
  socket: string;
  /** Finger and thumb-side directions at the face, in the head's frame. */
  finger: Vec3;
  thumb: Vec3;
  /** Where the fingertip comes from, just short of the socket (metres, head frame). */
  approach: Vec3;
  /** Where the hand rises to first, close in front of the chest (metres, body frame):
   * behind any held fan, so the hand never crosses the cards. */
  lift: Vec3;
  /** Where the fingertip rests against the socket (metres, head frame); at the socket if
   * omitted. */
  contact?: Vec3;
  /** The small movement at the face, from the contact: a rub at the nose, a tug at the ear. */
  rub: Vec3;
  /** How the head leans into the hand. */
  lean: Record<string, Vec3>;
}

/**
 * The right index fingertip on a face socket, the way people do it: the hand lifts off
 * the table straight up in front of the chest, the index finger straightening as it goes,
 * meets the face as the head leans in, rubs or tugs twice, and settles back the same way.
 */
const touch = ({
  socket,
  finger,
  thumb,
  approach,
  lift,
  contact = [0, 0, 0],
  rub,
  lean,
}: Touch): Clip => {
  const rubbed = contact.map((value, i) => value + rub[i]!) as Vec3;
  const at = (offset?: Vec3, shape = extended(1)): Reach => ({
    target: socket,
    at: offset,
    effector: 'IndexTip',
    finger,
    thumb,
    shape,
  });
  const raised: Reach = {
    target: 'body',
    at: lift,
    effector: 'IndexTip',
    finger,
    thumb,
    shape: rising,
  };
  const end = GESTURE_DURATION_MS;
  const still = { Head: [0, 0, 0] as Vec3, Neck: [0, 0, 0] as Vec3 };
  return {
    duration: end,
    peak: 900,
    keys: [
      { t: 0, R: REST, bones: still },
      { t: 300, R: raised },
      { t: 520, R: at(approach), bones: lean },
      { t: 650, R: at(contact) },
      { t: 820, R: at(rubbed) },
      { t: 980, R: at(contact) },
      { t: 1140, R: at(rubbed) },
      { t: 1300, R: at(contact), bones: lean },
      { t: 1450, R: at(approach) },
      { t: end - 300, R: raised },
      { t: end, R: REST, bones: still },
      // A knowing look: a half smile, eyes narrowed, the brows a touch low.
      { t: 0, face: { smile: 0.3, squint: 0.22, brows: -0.15 } },
    ],
  };
};

const earRight = touch({
  socket: 'EarR',
  // The hand up beside the head, fingers up and the palm toward it; the elbow below,
  // in front.
  finger: [0.2, 0.85, -0.45],
  thumb: [0, -0.3, -1],
  approach: [-0.05, -0.03, 0.02],
  lift: [-0.18, 1.02, 0.14],
  // The fingertip on the outside of the ear, so the hand stays clear of the head; then a
  // little tug down on the lobe.
  contact: [-0.012, 0, 0],
  rub: [-0.002, -0.008, 0],
  lean: { Head: [0, 0, -0.1], Neck: [0, 0, -0.04] },
});

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
  // Brows knit up in the middle, the mouth turned down and catching on each deep sob.
  face: { smile: -0.9, worry: 1, brows: 0.2, squint: 0.35, open: deep ? 0.45 : 0.15 },
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
    // A wide grin, eyes crinkled, the mouth opening on each pump.
    face: { smile: 1, brows: 0.6, squint: 0.22, open: i % 2 ? 0.75 : 0.4 },
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
      // "Who knows?": brows high, the mouth's corners pulled down.
      face: { smile: -0.45, brows: 1, worry: 0.35, open: 0.1 },
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
  nose: touch({
    socket: 'Nose',
    // A knowing tap on the side of the nose: the finger runs up across the cheek, palm
    // to the face, and arrives from below and to the side.
    finger: [0.55, 0.65, -0.5],
    thumb: [-0.67, 0.19, -0.49],
    approach: [-0.05, -0.04, 0.03],
    lift: [-0.1, 0.98, 0.2],
    // A rub up the side of the nose.
    rub: [0, 0.008, 0.002],
    lean: { Head: [0.08, 0, 0], Neck: [0.03, 0, 0] },
  }),
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
    // Eyes on the card going down, brows set; a small satisfied look as it lands.
    { t: 0, face: {} },
    { t: 380, face: { brows: -0.3, gazeY: -0.8 } },
    { t: 640, face: { smile: 0.3, brows: 0.1, gazeY: -0.5 } },
    { t: 1050, face: {} },
  ],
};
export const PLAY_RELEASE_MS = 540;

/** The pickup hand reaches the pile, and has drawn the gathered cards in to the chest. */
export const PICKUP_TAKE_MS = 560;
export const PICKUP_DRAWN_IN_MS = 1100;

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
    // Taking the pile is a loss: a scowl at it, then a sigh with the corners down.
    { t: 0, face: {} },
    { t: 450, face: { smile: -0.5, worry: -0.5, brows: -0.4, gazeY: -0.8 } },
    { t: 1000, face: { smile: -0.6, worry: 0.3, squint: 0.18, gazeY: -0.3 } },
    { t: 1350, face: {} },
  ],
};

/** The drawing hand closes on the deck. */
export const DRAW_TAKE_MS = 450;

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
    // A glance at the deck, then up to see what came.
    { t: 0, face: {} },
    { t: 380, face: { gazeY: -0.8, brows: -0.1 } },
    { t: 820, face: { gazeY: -0.3, brows: 0.25 } },
    { t: 1150, face: {} },
  ],
};

export type ActionId = 'play' | 'pickup' | 'draw';
/** Each action for the right hand, and mirrored for the left. */
export const ACTIONS: Readonly<Record<ActionId, { R: Clip; L: Clip }>> = {
  play: { R: play, L: mirrorClip(play) },
  pickup: { R: pickup, L: mirrorClip(pickup) },
  draw: { R: draw, L: mirrorClip(draw) },
};
