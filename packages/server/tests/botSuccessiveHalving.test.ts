import { describe, expect, it } from 'vitest';
import { BASELINE_POLICY } from '../src/ai/BotPolicy';
import { successiveHalving } from './botSuccessiveHalving';

describe('successive halving', () => {
  it('uses shared seed ranges and stops spending games on eliminated candidates', async () => {
    const policies = ['a', 'b', 'c', 'd'].map((id) => ({ ...BASELINE_POLICY, id }));
    const calls: Array<{ id: string; start: number; end: number }> = [];
    const result = await successiveHalving(policies, 8, async (policy, start, end) => {
      calls.push({ id: policy.id, start, end });
      const games = end - start;
      const wins = policy.id === 'a' ? games : policy.id === 'b' ? Math.ceil(games / 2) : 0;
      return {
        id: policy.id,
        generation: 0,
        policy,
        games,
        wins,
        stalled: 0,
        invalid: 0,
        actions: games,
        seatWins: [wins],
      };
    });
    expect(result.stages).toEqual([
      { seeds: 2, candidates: 4 },
      { seeds: 4, candidates: 2 },
      { seeds: 8, candidates: 2 },
    ]);
    expect(calls.filter((call) => call.start === 0)).toHaveLength(4);
    expect(calls.filter((call) => call.start === 2).map((call) => call.id)).toEqual(['a', 'b']);
    expect(result.rows.find((row) => row.id === 'c')?.games).toBe(2);
    expect(result.finalists.map((row) => row.id)).toEqual(['a', 'b']);
  });
});
