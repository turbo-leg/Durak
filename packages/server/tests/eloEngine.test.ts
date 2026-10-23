import { describe, expect, it } from 'vitest';
import { calculateEloDeltas, type EloPlayer } from '../src/utils/EloEngine';

const player = (id: string, placement: EloPlayer['placement']): EloPlayer => ({
  id,
  currentElo: 1000,
  gamesPlayed: 100,
  placement,
});

describe('Elo with one winner (or one winning team)', () => {
  it('moves only between winners and losers; equal placements tie', () => {
    const deltas = calculateEloDeltas([
      player('w', 'winner'),
      player('l1', 'durak'),
      player('l2', 'durak'),
    ]);
    expect(deltas.get('w')).toBe(8);
    // Each loser loses only to the winner, never to the other loser.
    expect(deltas.get('l1')).toBe(-4);
    expect(deltas.get('l2')).toBe(-4);
  });

  it('gives teammates the same change', () => {
    const deltas = calculateEloDeltas([
      player('a1', 'winner'),
      player('b1', 'durak'),
      player('a2', 'winner'),
      player('b2', 'durak'),
    ]);
    expect(deltas.get('a1')).toBe(deltas.get('a2'));
    expect(deltas.get('b1')).toBe(deltas.get('b2'));
    expect(deltas.get('a1')).toBeGreaterThan(0);
    expect(deltas.get('b1')).toBeLessThan(0);
  });
});
