import { describe, expect, it } from 'vitest';
import { duelReward } from './botReward';
import type { MatchResult } from './botMatch';

function result(winner: number, pickups: number[], hands: number[]): MatchResult {
  return {
    winner,
    actions: 20,
    stalled: false,
    invalid: false,
    pickupsBySeat: pickups,
    finalHandBySeat: hands,
  };
}

describe('duel training reward', () => {
  it('always values a win above a loss, even with bad pickup and hand counts', () => {
    expect(duelReward(result(0, [30, 0], [9, 0]), 0)).toBeGreaterThan(
      duelReward(result(1, [0, 30], [0, 9]), 0),
    );
  });

  it('penalizes finishing with many cards and repeated forced pickups', () => {
    const closeLoss = duelReward(result(1, [1, 2], [2, 0]), 0);
    const largeLoss = duelReward(result(1, [15, 2], [7, 0]), 0);
    expect(closeLoss).toBeGreaterThan(largeLoss);
  });
});
