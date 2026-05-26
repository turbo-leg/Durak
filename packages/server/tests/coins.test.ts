import { describe, it, expect } from 'vitest';
import { isSameUTCDay, COIN_REWARDS } from '../src/utils/coins';

describe('isSameUTCDay', () => {
  it('returns false for null', () => {
    expect(isSameUTCDay(null, new Date())).toBe(false);
  });

  it('returns true for the same UTC day', () => {
    const now = new Date('2025-06-15T14:00:00Z');
    const earlier = new Date('2025-06-15T00:01:00Z');
    expect(isSameUTCDay(earlier, now)).toBe(true);
  });

  it('returns false for different UTC days', () => {
    const today = new Date('2025-06-15T14:00:00Z');
    const yesterday = new Date('2025-06-14T23:59:59Z');
    expect(isSameUTCDay(yesterday, today)).toBe(false);
  });

  it('handles midnight boundary correctly', () => {
    const justBeforeMidnight = new Date('2025-06-14T23:59:59.999Z');
    const justAfterMidnight = new Date('2025-06-15T00:00:00.000Z');
    expect(isSameUTCDay(justBeforeMidnight, justAfterMidnight)).toBe(false);
  });
});

describe('COIN_REWARDS', () => {
  it('has expected values', () => {
    expect(COIN_REWARDS.WIN).toBe(50);
    expect(COIN_REWARDS.LOSE_CONSOLATION).toBe(10);
    expect(COIN_REWARDS.FIRST_GAME_OF_DAY).toBe(25);
    expect(COIN_REWARDS.DAILY_LOGIN).toBe(15);
    expect(COIN_REWARDS.RANK_UP).toBe(100);
  });
});
