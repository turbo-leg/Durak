import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tier } from '@durak/shared';

const TIER_CONFIG: Record<Tier, { label: string; icon: string; color: string }> = {
  bronze: { label: 'Bronze', icon: '🛡️', color: 'text-amber-500' },
  silver: { label: 'Silver', icon: '🛡️', color: 'text-slate-300' },
  gold: { label: 'Gold', icon: '👑', color: 'text-yellow-400' },
  platinum: { label: 'Platinum', icon: '💠', color: 'text-cyan-300' },
  diamond: { label: 'Diamond', icon: '💎', color: 'text-blue-200' },
};

interface Props {
  oldTier: Tier;
  newTier: Tier;
  direction: 'up' | 'down';
  onDismiss: () => void;
}

export const TierChangeOverlay: React.FC<Props> = ({ oldTier, newTier, direction, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const oldCfg = TIER_CONFIG[oldTier];
  const newCfg = TIER_CONFIG[newTier];
  const isUp = direction === 'up';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        <motion.div
          className="flex flex-col items-center gap-4 select-none"
          initial={{ scale: 0.6, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <span
            className={`text-3xl font-black tracking-widest uppercase ${isUp ? 'text-yellow-400' : 'text-slate-400'}`}
          >
            {isUp ? 'RANK UP!' : 'RANK DOWN'}
          </span>
          <div className="flex items-center gap-4 text-4xl">
            <span className={oldCfg.color}>
              {oldCfg.icon} {oldCfg.label}
            </span>
            <span className="text-white/60">{isUp ? '→' : '→'}</span>
            <span className={newCfg.color}>
              {newCfg.icon} {newCfg.label}
            </span>
          </div>
          <span className="text-xs text-white/40 mt-2">tap to dismiss</span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
