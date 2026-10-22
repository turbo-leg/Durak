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
