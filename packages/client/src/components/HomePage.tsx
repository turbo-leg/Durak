import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGame } from '../contexts/GameContext';
import { colors, fonts } from '../theme';
import { Sheet, Diamond } from './ui';
import { useIsShortViewport } from '../utils/useIsShortViewport';
import { FloatingCard, MiniCard, MiniCardFan, ModeCard } from './home/cards';
import { SearchingOverlay, RankedConfigSheet, SinglePlayerSheet } from './home/sheets';
import { CustomLobbySheet } from './home/CustomLobbySheet';
import { FLOATING_CARDS } from './home/helpers';
import type { HomeState, SheetKey, RankedOptions } from './home/helpers';

interface HomePageProps {
  discordId?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
  error?: string | null;
}

// ── Main HomePage ─────────────────────────────────────────────────────────────

export const HomePage: React.FC<HomePageProps> = ({
  discordId,
  userId,
  username,
  avatarUrl,
  error,
}) => {
  const { joinOrCreateGame, leaveGame } = useGame();
  const { t } = useTranslation('home');
  const short = useIsShortViewport();
  const [phase, setPhase] = useState<'intro' | 'home'>('intro');
  const [homeState, setHomeState] = useState<HomeState>('home');
  const [sheet, setSheet] = useState<SheetKey>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('home'), 1300);
    return () => clearTimeout(timer);
  }, []);

  const handleFindMatch = async (opts: RankedOptions) => {
    setSheet(null);
    setHomeState('searching');
    cancelRef.current = false;

    // Fetch the player's ELO to compute their matchmaking tier (±200 band).
    // Unauthenticated players and new accounts default to tier 1000 (starting ELO).
    let eloTier = 1000;
    if (discordId || userId) {
      try {
        const id = discordId ?? userId!;
        const byParam = discordId ? '' : '?by=user';
        const res = await fetch(`/api/profile/${id}${byParam}`);
        if (res.ok) {
          const profile = await res.json();
          const elo: number = profile?.eloClassic ?? 1000;
          eloTier = Math.floor(elo / 200) * 200;
        }
      } catch {
        // network error — fall back to default tier
      }
    }

    if (cancelRef.current) {
      setHomeState('home');
      return;
    }

    await joinOrCreateGame({
      ...opts,
      isPrivate: false,
      teamSelection: 'random',
      eloTier,
      ...(discordId ? { discordId } : {}),
      ...(userId ? { userId } : {}),
      ...(username ? { username } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    });

    // If the user cancelled while joinOrCreate was in flight, immediately leave.
    if (cancelRef.current) {
      leaveGame();
    }
  };

  const handleCancelMatch = () => {
    cancelRef.current = true;
    leaveGame();
    setHomeState('home');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Short (landscape) viewports: let content scroll from the top instead of
        // centering + clipping it behind the bottom nav.
        justifyContent: short ? 'flex-start' : 'center',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: short ? 'auto' : 'hidden',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        paddingTop: short
          ? 'calc(env(safe-area-inset-top, 0px) + 16px)'
          : 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Faint repeating diamond engraving */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 55%)',
        }}
      />

      {/* Floating intro cards — hidden on short/landscape viewports where they'd
          overlap the logo and steal vertical space. */}
      {!short && FLOATING_CARDS.map((c, i) => <FloatingCard key={i} {...c} />)}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, type: 'spring' }}
        style={{
          textAlign: 'center',
          zIndex: 10,
          marginBottom: short ? 20 : 52,
          position: 'relative',
        }}
      >
        {/* Ornament above */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 60,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6))',
            }}
          />
          <Diamond size={9} />
          <div
            style={{
              width: 60,
              height: 1,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.6), transparent)',
            }}
          />
        </div>

        <motion.div
          initial={{ scale: 0.65, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 110, damping: 12 }}
          className="casino-gold-text casino-shimmer"
          style={{
            fontFamily: fonts.display,
            fontSize: 'clamp(60px, 11vw, 96px)',
            fontWeight: 900,
            letterSpacing: 6,
            lineHeight: 1,
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 4px 30px rgba(212,175,55,0.45))',
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #8b6914 85%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          DURAK
        </motion.div>

        {error && (
          <div
            style={{
              color: '#ff9999',
              fontSize: 12,
              marginTop: 14,
              fontWeight: 700,
              fontFamily: fonts.body,
              letterSpacing: 0.5,
            }}
          >
            {error}
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {homeState === 'searching' && (
          <SearchingOverlay
            key="searching"
            label={t('searching.label')}
            onCancel={handleCancelMatch}
          />
        )}

        {homeState === 'home' && phase === 'home' && (
          <motion.div
            key="home-buttons"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
            style={{
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: short ? 16 : 28,
            }}
          >
            {/* Hero PLAY chip — looks like a casino chip */}
            <motion.button
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setSheet('ranked')}
              style={{
                width: short ? 132 : 188,
                height: short ? 132 : 188,
                borderRadius: '50%',
                background:
                  'repeating-conic-gradient(from 0deg, #d4af37 0deg 30deg, #8b6914 30deg 60deg)',
                padding: 8,
                border: 'none',
                cursor: 'pointer',
                boxShadow:
                  '0 0 64px rgba(212,175,55,0.5), 0 16px 40px rgba(0,0,0,0.8), inset 0 0 0 2px rgba(0,0,0,0.4)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 30% 25%, #0d4630 0%, #07261a 65%, #04150e 100%)',
                  border: `3px solid ${colors.gold[500]}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  color: colors.gold[300],
                  fontFamily: fonts.display,
                  letterSpacing: 4,
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}
              >
                <span style={{ fontSize: 38, lineHeight: 1 }}>♠</span>
                <span style={{ fontSize: 20, fontWeight: 900 }}>{t('modes.play')}</span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: 3,
                    opacity: 0.65,
                    color: colors.ivory[200],
                    textTransform: 'uppercase',
                  }}
                >
                  {t('modes.ranked')}
                </span>
              </div>
            </motion.button>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: 460,
                padding: '0 16px',
              }}
            >
              <ModeCard
                icon={<MiniCard suit="♠" rank="A" size={32} />}
                title={t('modes.ranked')}
                subtitle={t('modes.rankedSub')}
                accent="rgba(212,175,55,0.45)"
                delay={0.1}
                onClick={() => setSheet('ranked')}
              />
              <ModeCard
                icon={<MiniCardFan size={26} />}
                title={t('modes.custom')}
                subtitle={t('modes.customSub')}
                accent="rgba(212,175,55,0.45)"
                delay={0.17}
                onClick={() => setSheet('custom')}
              />
              <ModeCard
                icon={<MiniCard suit="♥" rank="A" size={32} />}
                title={t('modes.solo')}
                subtitle={t('modes.soloSub')}
                accent="rgba(212,175,55,0.45)"
                delay={0.24}
                onClick={() => setSheet('solo')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === 'ranked' && (
          <Sheet
            title={t('ranked.title')}
            icon={<MiniCard suit="♠" rank="A" size={20} />}
            onClose={() => setSheet(null)}
          >
            <RankedConfigSheet onFindMatch={handleFindMatch} />
          </Sheet>
        )}
        {sheet === 'custom' && (
          <Sheet
            title={t('custom.title')}
            icon={<MiniCardFan size={16} />}
            onClose={() => setSheet(null)}
          >
            <CustomLobbySheet
              discordId={discordId}
              userId={userId}
              username={username}
              avatarUrl={avatarUrl}
            />
          </Sheet>
        )}
        {sheet === 'solo' && (
          <Sheet
            title={t('solo.title')}
            icon={<MiniCard suit="♥" rank="A" size={20} />}
            onClose={() => setSheet(null)}
          >
            <SinglePlayerSheet />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
};
