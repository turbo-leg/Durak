import { describe, expect, it } from 'vitest';
import { CHAMPION_POLICY } from '../src/ai/BotChampion';
import { playBotMatch } from './botMatch';
import { BotMatchPool } from './botMatchPool';

describe('seeded bot matches', () => {
  it('replays identically when matches overlap and leaves global randomness untouched', async () => {
    const originalRandom = Math.random;
    const seeds = [12001, 12002, 12003, 12004];
    const serial = [];
    for (const seed of seeds)
      serial.push(await playBotMatch(seed, 0, CHAMPION_POLICY, { players: 2 }));
    const parallel = await Promise.all(
      seeds.map((seed) => playBotMatch(seed, 0, CHAMPION_POLICY, { players: 2 })),
    );
    expect(parallel).toEqual(serial);
    expect(Math.random).toBe(originalRandom);
  });

  it('returns the same seeded outcomes from separate workers', async () => {
    const seeds = [12001, 12002, 12003, 12004];
    const pool = new BotMatchPool(2);
    try {
      const jobs = seeds.map((seed) =>
        pool.run([{ seed, seat: 0, policy: CHAMPION_POLICY, options: { players: 2 } }]),
      );
      const parallel = (await Promise.all(jobs)).map((batch) => batch[0]);
      const serial = [];
      for (const seed of seeds)
        serial.push(await playBotMatch(seed, 0, CHAMPION_POLICY, { players: 2 }));
      expect(parallel).toEqual(serial);
    } finally {
      await pool.close();
    }
  }, 30000);
});
