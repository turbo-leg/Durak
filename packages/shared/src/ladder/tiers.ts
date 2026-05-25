export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierInfo {
  tier: Tier;
  /** 0.0 – 1.0 progress within the current tier toward the next */
  progress: number;
  /** Elo needed to reach the next tier, or null if already Diamond */
  nextThreshold: number | null;
}

const THRESHOLDS: [Tier, number][] = [
  ['diamond', 1600],
  ['platinum', 1400],
  ['gold', 1200],
  ['silver', 1000],
  ['bronze', 0],
];

export function getTier(elo: number): Tier {
  for (const [tier, min] of THRESHOLDS) {
    if (elo >= min) return tier;
  }
  return 'bronze';
}

export function getTierInfo(elo: number): TierInfo {
  const floors = [0, 1000, 1200, 1400, 1600] as const;
  const ceilings = [1000, 1200, 1400, 1600, Infinity] as const;
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

  const tier = getTier(elo);
  const idx = tiers.indexOf(tier);
  const isDiamond = idx === 4;

  const progress = isDiamond ? 1 : Math.min((elo - floors[idx]) / (ceilings[idx] - floors[idx]), 1);

  return {
    tier,
    progress,
    nextThreshold: isDiamond ? null : ceilings[idx],
  };
}
