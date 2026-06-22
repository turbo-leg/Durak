import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../contexts/GameContext';
import { colors, gradients, shadows, radii, fonts } from '../../theme';
import { GoldButton, Pill, SectionLabel, Divider } from '../ui';
import { getAvailableHandSizes } from './helpers';
import type { RankedOptions } from './helpers';

// ── Searching overlay ─────────────────────────────────────────────────────────

export function SearchingOverlay({ onCancel, label }: { onCancel: () => void; label: string }) {
  const { t } = useTranslation('home');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        zIndex: 10,
      }}
    >
      {/* Rotating roulette-style ring */}
      <div style={{ position: 'relative', width: 168, height: 168 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(${colors.gold[500]} 0deg, transparent 60deg, ${colors.gold[500]} 120deg, transparent 180deg, ${colors.gold[500]} 240deg, transparent 300deg)`,
            mask: 'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
            WebkitMask: 'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
            filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.5))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 16,
            borderRadius: '50%',
            background: gradients.velvet,
            border: `2px solid ${colors.gold[600]}`,
            boxShadow: `inset 0 0 24px rgba(0,0,0,0.6), ${shadows.goldGlow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
          }}
        >
          ♠
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 22,
            color: colors.gold[300],
            letterSpacing: 4,
            textTransform: 'uppercase',
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: colors.ivory[300],
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1,
          }}
        >
          {fmt(elapsed)}
        </div>
      </div>

      <GoldButton variant="burgundy" size="md" onClick={onCancel}>
        {t('searching.cancel')}
      </GoldButton>
    </motion.div>
  );
}

// ── Ranked config sheet ───────────────────────────────────────────────────────

export function RankedConfigSheet({ onFindMatch }: { onFindMatch: (opts: RankedOptions) => void }) {
  const { t } = useTranslation('home');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [handSize, setHandSize] = useState(5);

  const playerOptions = [2, 3, 4, 5, 6];
  const handSizeOptions = getAvailableHandSizes('classic', maxPlayers);
  const effectiveHandSize = handSizeOptions.includes(handSize) ? handSize : handSizeOptions[0]!;

  const handlePlayerChange = (n: number) => {
    setMaxPlayers(n);
    const hs = getAvailableHandSizes('classic', n);
    if (!hs.includes(handSize)) setHandSize(hs[0]!);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <SectionLabel>{t('ranked.playersAtTable')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {playerOptions.map((n) => (
            <Pill key={n} active={maxPlayers === n} onClick={() => handlePlayerChange(n)}>
              {n}
            </Pill>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: colors.ivory[300],
            marginTop: 8,
            opacity: 0.7,
            fontStyle: 'italic',
          }}
        >
          {t('ranked.gameBegins', { count: maxPlayers })}
        </div>
      </div>

      {handSizeOptions.length > 1 && (
        <div>
          <SectionLabel>{t('ranked.cardsInHand')}</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {handSizeOptions.map((s) => (
              <button
                key={s}
                onClick={() => setHandSize(s)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  borderRadius: radii.md,
                  cursor: 'pointer',
                  background: effectiveHandSize === s ? gradients.gold : 'rgba(255,255,255,0.03)',
                  color: effectiveHandSize === s ? colors.ink[900] : colors.ivory[200],
                  border: `1.5px solid ${
                    effectiveHandSize === s ? 'rgba(212,175,55,0.85)' : 'rgba(212,175,55,0.18)'
                  }`,
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: 22,
                  boxShadow:
                    effectiveHandSize === s
                      ? `${shadows.engrave}, ${shadows.goldGlow}`
                      : shadows.engrave,
                  transition: 'all 0.18s',
                }}
              >
                {s}
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 10,
                    fontWeight: 600,
                    marginTop: 2,
                    opacity: 0.7,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('ranked.cards')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Divider label={t('ranked.stakeRep')} />

      <GoldButton
        size="lg"
        block
        onClick={() => onFindMatch({ mode: 'classic', maxPlayers, handSize: effectiveHandSize })}
      >
        {t('ranked.findMatch')}
      </GoldButton>
    </div>
  );
}

// ── Single Player sheet ───────────────────────────────────────────────────────

const DIFFICULTIES = [
  {
    key: 'easy',
    label: 'Apprentice',
    icon: 'badge_apprentice.png',
    desc: 'Plays loosely, makes mistakes.',
    accent: '#3f8a4a',
  },
  {
    key: 'medium',
    label: 'Gentleman',
    icon: 'badge_gentleman.png',
    desc: 'Plays smart, occasional blunders.',
    accent: colors.gold[500],
  },
  {
    key: 'hard',
    label: 'High Roller',
    icon: 'badge_high_roller.png',
    desc: 'Ruthless. Calculates every card.',
    accent: '#a01818',
  },
] as const;

export function SinglePlayerSheet() {
  const { createGame } = useGame();
  const { t } = useTranslation('home');
  const [loading, setLoading] = useState<string | null>(null);

  const handlePick = async (difficulty: string) => {
    setLoading(difficulty);
    await createGame({
      maxPlayers: 2,
      isPrivate: true,
      mode: 'classic',
      teamSelection: 'random',
      handSize: 6,
      botDifficulty: difficulty,
    });
    setLoading(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>{t('solo.chooseOpponent')}</SectionLabel>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.key}
          onClick={() => handlePick(d.key)}
          disabled={loading !== null}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 18px',
            borderRadius: radii.md,
            cursor: loading ? 'default' : 'pointer',
            background: gradients.panel,
            border: `1.5px solid ${d.accent}88`,
            color: colors.ivory[100],
            textAlign: 'left',
            transition: 'all 0.15s',
            boxShadow: `${shadows.low}, ${shadows.engrave}, 0 0 0 1px ${d.accent}33 inset`,
            opacity: loading && loading !== d.key ? 0.45 : 1,
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 10px rgba(0,0,0,0.6), 0 0 12px ${d.accent}44`,
              border: `1.5px solid ${d.accent}`,
              background: 'rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}
          >
            {loading === d.key ? (
              <span style={{ fontSize: 24 }}>⏳</span>
            ) : (
              <img
                src={`/assets/badges/${d.icon}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: 1,
                color: colors.gold[300],
              }}
            >
              {t(
                `solo.${d.key === 'easy' ? 'apprentice' : d.key === 'medium' ? 'gentleman' : 'highRoller'}`,
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.ivory[300],
                marginTop: 4,
                opacity: 0.85,
              }}
            >
              {t(
                `solo.${d.key === 'easy' ? 'apprenticeDesc' : d.key === 'medium' ? 'gentlemanDesc' : 'highRollerDesc'}`,
              )}
            </div>
          </div>
          <span style={{ color: d.accent, fontSize: 22 }}>›</span>
        </button>
      ))}
    </div>
  );
}
