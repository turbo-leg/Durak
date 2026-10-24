import type { MatchResult } from './botMatch';

/** Bounded duel training signal. Terminal wins dominate all shaping terms. */
export function duelReward(game: MatchResult, seat: number): number {
  const opponent = 1 - seat;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const terminal = game.winner === seat ? 1 : -1;
  const handGap = clamp(
    ((game.finalHandBySeat[opponent] ?? 0) - (game.finalHandBySeat[seat] ?? 0)) / 10,
  );
  const pickupGap = clamp(
    ((game.pickupsBySeat[opponent] ?? 0) - (game.pickupsBySeat[seat] ?? 0)) / 10,
  );
  return terminal + 0.1 * handGap + 0.05 * pickupGap;
}
