import React from 'react';
import type { Tier, TierInfo } from '@durak/shared';

const TIER_CONFIG: Record<Tier, { label: string; icon: string; color: string; bg: string }> = {
  bronze: {
    label: 'Bronze',
    icon: '🛡️',
    color: 'text-amber-600',
    bg: 'bg-amber-900/40 border-amber-700',
  },
  silver: {
    label: 'Silver',
    icon: '🛡️',
    color: 'text-slate-300',
    bg: 'bg-slate-700/40 border-slate-500',
  },
  gold: {
    label: 'Gold',
    icon: '👑',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/40 border-yellow-600',
  },
  platinum: {
    label: 'Platinum',
    icon: '💠',
    color: 'text-cyan-300',
    bg: 'bg-cyan-900/40 border-cyan-600',
  },
  diamond: {
    label: 'Diamond',
    icon: '💎',
    color: 'text-blue-200',
    bg: 'bg-blue-900/40 border-blue-400',
  },
};

interface SmallProps {
  tier: Tier;
}
interface MediumProps {
  tier: Tier;
}
interface LargeProps {
  tierInfo: TierInfo;
}

/** Icon only — for in-game nameplates */
export const TierBadgeSm: React.FC<SmallProps> = ({ tier }) => {
  const cfg = TIER_CONFIG[tier];
  return (
    <span title={cfg.label} className={`text-[10px] leading-none ${cfg.color}`}>
      {cfg.icon}
    </span>
  );
};

/** Icon + label — for leaderboard rows */
export const TierBadgeMd: React.FC<MediumProps> = ({ tier }) => {
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold border rounded-full px-1.5 py-0.5 ${cfg.color} ${cfg.bg}`}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
};

/** Icon + label + progress bar — for profile panel */
export const TierBadgeLg: React.FC<LargeProps> = ({ tierInfo }) => {
  const cfg = TIER_CONFIG[tierInfo.tier];
  const pct = Math.round(tierInfo.progress * 100);

  return (
    <div className={`flex flex-col gap-1 border rounded-lg px-3 py-2 ${cfg.bg}`}>
      <div className={`flex items-center gap-1.5 font-bold text-sm ${cfg.color}`}>
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </div>
      <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tierInfo.tier === 'diamond'
              ? 'bg-blue-300'
              : tierInfo.tier === 'platinum'
                ? 'bg-cyan-400'
                : tierInfo.tier === 'gold'
                  ? 'bg-yellow-400'
                  : tierInfo.tier === 'silver'
                    ? 'bg-slate-300'
                    : 'bg-amber-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-indigo-400">
        {tierInfo.nextThreshold
          ? `${pct}% to ${TIER_CONFIG[nextTier(tierInfo.tier)!].label}`
          : 'Max rank'}
      </div>
    </div>
  );
};

const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
function nextTier(tier: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}
