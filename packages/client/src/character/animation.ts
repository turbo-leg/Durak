import type { Finger, Side } from './spec.ts';

/**
 * Clips are data. Arms are driven by reach targets solved with IK at runtime, so
 * contact (a fingertip on the nose, a card on the table) is exact on any body; the
 * spine and head take additive rotations.
 */

export type Vec3 = [number, number, number];

export interface HandShape {
  /** 0 straight to 1 closed, per finger; omitted fingers are straight. */
  curl?: Partial<Record<Finger, number>>;
  /** Fingers fan apart (radians at the knuckle). */
  spread?: number;
  /** 0 the relaxed thumb to 1 folded across the palm. */
  thumb?: number;
}

export interface Reach {
  /**
   * Frame of `at`, `finger` and `thumb`: `body` (the character root), a head socket
   * (`Eyes`, `Nose`, `EarL`, `EarR`, which turn with the head) or a runtime target
   * the renderer supplies (for example `table` or `deck`).
   */
  target: string;
  at?: Vec3;
  /** The part of the hand placed at the target. */
  effector?: 'Wrist' | 'IndexTip' | 'Palm';
  /** Directions of the fingers and of the thumb side of the hand. */
  finger: Vec3;
  thumb: Vec3;
  shape?: HandShape;
}

export interface Key {
  /** Milliseconds from the clip's start. */
  t: number;
  R?: Reach;
  L?: Reach;
  /** Additive rotations (radians, XYZ) for spine, neck, head and shoulders. */
  bones?: Record<string, Vec3>;
}

export interface Clip {
  /** Total length in milliseconds; the pose blends in and out within it. */
  duration: number;
  fade?: number;
  /** The moment shown statically when motion is reduced. */
  peak?: number;
  keys: Key[];
}

/** Empty-handed: wrists rest on the table edge, fingers relaxed. */
export const REST: Reach = {
  target: 'body',
  // Wrists rest on the table's edge, 38 cm in front of the chair; the hand arches a little,
  // so its curled fingertips just touch the felt.
  at: [-0.2, 0.775, 0.36],
  finger: [0, 0.2, 1],
  thumb: [1, 0, 0],
  shape: { curl: { Index: 0.3, Middle: 0.35, Ring: 0.4, Pinky: 0.45 }, thumb: 0.15 },
};

/** A free arm let down beside the hip, palm to the thigh: out of the way of a low fan. */
export const ASIDE: Reach = {
  target: 'body',
  at: [-0.3, 0.68, 0.04],
  finger: [0, -1, 0.35],
  thumb: [0, 0.35, 1],
  shape: { curl: { Index: 0.3, Middle: 0.35, Ring: 0.4, Pinky: 0.45 }, thumb: 0.15 },
};

/** Further back beside the hip, as if leaning on the hand: clear of a fan held low and wide
 * on that side. */
export const BEHIND: Reach = {
  target: 'body',
  at: [-0.27, 0.64, -0.12],
  finger: [0, -1, -0.1],
  thumb: [0, 0.1, 1],
  shape: { curl: { Index: 0.3, Middle: 0.35, Ring: 0.4, Pinky: 0.45 }, thumb: 0.15 },
};

const SIDE_NAME = /(L|R)$/;
const swapName = (name: string) => name.replace(SIDE_NAME, (side) => (side === 'L' ? 'R' : 'L'));
const flip = ([x, y, z]: Vec3): Vec3 => [-x, y, z];

function mirrorReach(reach: Reach): Reach {
  return {
    ...reach,
    target: reach.target.startsWith('Ear') ? swapName(reach.target) : reach.target,
    at: reach.at && flip(reach.at),
    finger: flip(reach.finger),
    thumb: flip(reach.thumb),
  };
}

/** The same clip performed by the other hand, reflected across the body's midline. */
export function mirrorClip(clip: Clip): Clip {
  return {
    ...clip,
    keys: clip.keys.map((key) => ({
      t: key.t,
      R: key.L && mirrorReach(key.L),
      L: key.R && mirrorReach(key.R),
      bones:
        key.bones &&
        Object.fromEntries(
          Object.entries(key.bones).map(([name, [x, y, z]]) => [swapName(name), [x, -y, -z]]),
        ),
    })),
  };
}

/**
 * A keyed track's value at `time`, passing smoothly through every key: motion carries on
 * through a waypoint instead of stopping there, and comes to rest only at the first and
 * last keys and wherever a value holds or turns back, so it never overshoots a key
 * (a monotone cubic; two keys ease in and out).
 */
export function track(times: number[], values: number[][], time: number): number[] {
  const last = times.length - 1;
  if (last === 0 || time <= times[0]!) return [...values[0]!];
  if (time >= times[last]!) return [...values[last]!];
  let i = 0;
  while (times[i + 1]! <= time) i++;
  const span = (k: number) => times[k + 1]! - times[k]!;
  const slope = (k: number, c: number) => (values[k + 1]![c]! - values[k]![c]!) / span(k);
  const tangent = (k: number, c: number) => {
    if (k === 0 || k === last) return 0;
    const [before, after] = [slope(k - 1, c), slope(k, c)];
    if (before * after <= 0) return 0;
    // A weighted harmonic mean of the neighbouring slopes keeps each stretch monotone.
    const [a, b] = [2 * span(k) + span(k - 1), span(k) + 2 * span(k - 1)];
    return (a + b) / (a / before + b / after);
  };
  const h = span(i);
  const s = (time - times[i]!) / h;
  const [h00, h10, h01, h11] = [
    2 * s ** 3 - 3 * s ** 2 + 1,
    s ** 3 - 2 * s ** 2 + s,
    -2 * s ** 3 + 3 * s ** 2,
    s ** 3 - s ** 2,
  ];
  return values[i]!.map(
    (from, c) =>
      h00 * from + h10 * h * tangent(i, c) + h01 * values[i + 1]![c]! + h11 * h * tangent(i + 1, c),
  );
}

/** Weight of a clip at `time`: eased in and out over `fade`; 1 throughout when reduced. */
export function clipWeight(clip: Clip, time: number, reduced = false) {
  if (time < 0 || time >= clip.duration) return 0;
  if (reduced) return 1;
  const fade = clip.fade ?? 250;
  const t = Math.min(1, time / fade, (clip.duration - time) / fade);
  return t * t * (3 - 2 * t);
}

export const sidesOf = (clip: Clip): Side[] =>
  (['L', 'R'] as const).filter((side) => clip.keys.some((key) => key[side]));
