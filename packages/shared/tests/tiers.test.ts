import { describe, it, expect } from 'vitest';
import { getTier, getTierInfo } from '../src/ladder/tiers';

describe('getTier', () => {
  it('returns bronze below 1000', () => {
    expect(getTier(0)).toBe('bronze');
    expect(getTier(500)).toBe('bronze');
    expect(getTier(999)).toBe('bronze');
  });

  it('returns silver at 1000–1199', () => {
    expect(getTier(1000)).toBe('silver');
    expect(getTier(1100)).toBe('silver');
    expect(getTier(1199)).toBe('silver');
  });

  it('returns gold at 1200–1399', () => {
    expect(getTier(1200)).toBe('gold');
    expect(getTier(1300)).toBe('gold');
    expect(getTier(1399)).toBe('gold');
  });

  it('returns platinum at 1400–1599', () => {
    expect(getTier(1400)).toBe('platinum');
    expect(getTier(1500)).toBe('platinum');
    expect(getTier(1599)).toBe('platinum');
  });

  it('returns diamond at 1600+', () => {
    expect(getTier(1600)).toBe('diamond');
    expect(getTier(2000)).toBe('diamond');
    expect(getTier(9999)).toBe('diamond');
  });
});

describe('getTierInfo', () => {
  it('progress is 0 at the floor of a tier', () => {
    expect(getTierInfo(0).progress).toBe(0);
    expect(getTierInfo(1000).progress).toBe(0);
    expect(getTierInfo(1200).progress).toBe(0);
  });

  it('progress is 1 at the ceiling of a tier', () => {
    // 999 is 999/1000 = 0.999, not 1 — ceiling is exclusive
    expect(getTierInfo(999).progress).toBeCloseTo(0.999);
    // 1199 is 199/200 within silver
    expect(getTierInfo(1199).progress).toBeCloseTo(0.995);
  });

  it('diamond always has progress 1 and no nextThreshold', () => {
    const info = getTierInfo(1600);
    expect(info.progress).toBe(1);
    expect(info.nextThreshold).toBeNull();

    const high = getTierInfo(9999);
    expect(high.progress).toBe(1);
    expect(high.nextThreshold).toBeNull();
  });

  it('nextThreshold is correct for each tier', () => {
    expect(getTierInfo(500).nextThreshold).toBe(1000); // bronze → silver
    expect(getTierInfo(1100).nextThreshold).toBe(1200); // silver → gold
    expect(getTierInfo(1300).nextThreshold).toBe(1400); // gold → platinum
    expect(getTierInfo(1500).nextThreshold).toBe(1600); // platinum → diamond
  });

  it('midpoint progress is ~0.5', () => {
    // Silver: 1000–1200, midpoint 1100 → 100/200 = 0.5
    expect(getTierInfo(1100).progress).toBeCloseTo(0.5);
    // Gold: 1200–1400, midpoint 1300 → 100/200 = 0.5
    expect(getTierInfo(1300).progress).toBeCloseTo(0.5);
  });
});
