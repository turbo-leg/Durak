import React from 'react';
import { motion } from 'framer-motion';
import { colors, gradients, shadows, radii, fonts } from '../../theme';
import { PlayingCard } from '../PlayingCard';

// ── Floating intro cards ──────────────────────────────────────────────────────

export function FloatingCard({
  suit,
  rank,
  delay,
  x,
  rotate,
  scale,
}: {
  suit: string;
  rank: string;
  delay: number;
  x: number;
  rotate: number;
  scale: number;
}) {
  return (
    <motion.div
      initial={{ y: -180, opacity: 0, rotate: rotate - 25 }}
      animate={{ y: 0, opacity: 1, rotate }}
      transition={{ delay, duration: 0.9, type: 'spring', stiffness: 70, damping: 13 }}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: '5%',
        scale,
        zIndex: 1,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.55))',
      }}
    >
      <PlayingCard suit={suit} rank={rank} width={64} />
    </motion.div>
  );
}

// ── Mini playing card — real card art, used as on-brand icons across the home screen ──

export const MiniCard: React.FC<{
  suit: string;
  rank: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ suit, rank, size = 30, style }) => (
  <PlayingCard suit={suit} rank={rank} width={size} style={style} />
);

// Two overlapping cards, for the "Custom" mode (variety / browse).
export const MiniCardFan: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <div
    style={{ position: 'relative', width: Math.round(size * 1.55), height: Math.round(size * 1.5) }}
  >
    <MiniCard
      suit="♠"
      rank="K"
      size={size}
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        transform: 'rotate(-13deg)',
        transformOrigin: 'bottom right',
      }}
    />
    <MiniCard
      suit="♥"
      rank="A"
      size={size}
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        transform: 'rotate(13deg)',
        transformOrigin: 'bottom left',
      }}
    />
  </div>
);

// ── Mode Button (large, on home screen) ───────────────────────────────────────

export const ModeCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  delay: number;
  onClick: () => void;
}> = ({ icon, title, subtitle, accent, delay, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 160, damping: 20 }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      background: gradients.panel,
      border: `1.5px solid ${accent}`,
      borderRadius: radii.md,
      padding: '16px 18px',
      color: colors.ivory[100],
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: '1 1 180px',
      minWidth: 175,
      boxShadow: `${shadows.mid}, ${shadows.engrave}`,
      textAlign: 'left',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 90,
        height: 90,
        background: 'radial-gradient(circle at top right, rgba(212,175,55,0.22), transparent 60%)',
        pointerEvents: 'none',
      }}
    />
    <span
      style={{
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))',
      }}
    >
      {icon}
    </span>
    <div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.gold[300],
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: colors.ivory[300],
          marginTop: 3,
          opacity: 0.8,
          letterSpacing: 0.3,
        }}
      >
        {subtitle}
      </div>
    </div>
  </motion.button>
);
