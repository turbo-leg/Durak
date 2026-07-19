import { useGame } from './contexts/GameContext';
import { useEffect, useState } from 'react';
import { motion, MotionConfig, AnimatePresence } from 'framer-motion';
import { useSettings } from './contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from './utils/useIsDesktop';
import { colors, gradients, shadows } from './theme';
import { GameBoard } from './components/GameBoard';
import { ShopPage } from './components/ShopPage';
import { HomePage } from './components/HomePage';
import { ProfilePage } from './components/ProfilePage';
import { RulesPage } from './components/RulesPage';
import { SettingsPage } from './components/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SpringScroll } from './components/SpringScroll';
import { isEmbedded, setupDiscordSdk, discordSdk, type DiscordAuthInfo } from './discordAuth';
import { useAuth } from './contexts/AuthContext';
import { initPushNotifications } from './utils/pushService';
import './App.css';

type NavTab = 'home' | 'shop' | 'profile' | 'rules' | 'settings';

function ConnectingSplash({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        gap: 20,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: '4px solid rgba(212,175,55,0.2)',
          borderTopColor: '#d4af37',
          animation: 'spin 1.1s linear infinite',
        }}
      />
      <div
        style={{
          color: '#f4d774',
          fontFamily: "'Cinzel', Georgia, serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Game({ discordAuth }: { discordAuth?: DiscordAuthInfo | null }) {
  const { room, isConnected, isReconnecting, error, leaveGame, autoJoinDiscordRoom, gameState } =
    useGame();
  const { user: browserAuth, handleOAuthCallback } = useAuth();
  const { settings } = useSettings();
  const { t } = useTranslation('common');
  const [navTab, setNavTab] = useState<NavTab>('home');
  const isDesktop = useIsDesktop();
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Sync animations setting to a body class so CSS @keyframes are also suppressed
  useEffect(() => {
    document.body.classList.toggle('no-animations', !settings.animations);
  }, [settings.animations]);

  const handleLeave = () => {
    if (settings.confirmLeave && !window.confirm(t('errors.leaveGame'))) return;
    leaveGame();
  };

  // Handle Discord OAuth callback (?code=... or ?error=...) for browser login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error');
    if (!isEmbedded && oauthError) {
      // Discord returned an error (e.g. user denied, invalid redirect URI)
      const desc = params.get('error_description') ?? oauthError;
      console.error('Discord OAuth error:', desc);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (code && !isEmbedded) {
      void handleOAuthCallback(code);
    }
  }, [handleOAuthCallback]);

  // Init push notifications once the user is authenticated (email JWT or Discord session)
  useEffect(() => {
    const token = browserAuth?.token;
    if (token) {
      void initPushNotifications(token);
    }
  }, [browserAuth?.token]);

  // Issue #69: Auto-join the Discord Instance Lobby
  useEffect(() => {
    if (discordAuth && discordSdk?.instanceId && !isConnected && !room) {
      const username = discordAuth.user.global_name || discordAuth.user.username;
      const userId = discordAuth.user.id;
      const avatarHash = discordAuth.user.avatar;

      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userId || '0') % 5}.png`;

      autoJoinDiscordRoom(discordSdk.instanceId, username, avatarUrl, userId);
    }
  }, [discordAuth, isConnected, room, autoJoinDiscordRoom]);

  // Resolve the active identity: embedded SDK > browser Discord OAuth > email account
  const activeDiscordId =
    discordAuth?.user.id ?? (browserAuth?.method === 'discord' ? browserAuth.id : undefined);
  const activeUserId = browserAuth?.method === 'email' ? browserAuth.id : undefined;
  const activeUsername =
    discordAuth?.user.global_name ||
    discordAuth?.user.username ||
    browserAuth?.globalName ||
    browserAuth?.username;
  const activeAvatarUrl = discordAuth?.user.avatar
    ? `https://cdn.discordapp.com/avatars/${discordAuth.user.id}/${discordAuth.user.avatar}.png?size=128`
    : browserAuth?.avatarUrl;

  // When in waiting phase, GameBoard renders a full-screen lobby — hide all App chrome
  const isWaitingPhase = isConnected && gameState?.phase === 'waiting';

  // While in a live game, show GameBoard full-screen without the nav shell
  if (isWaitingPhase || isConnected) {
    return (
      <MotionConfig reducedMotion={settings.animations ? 'never' : 'always'}>
        <div className="relative">
          <GameBoard />
          {isConnected && room && (
            <button
              onClick={handleLeave}
              style={{
                position: 'fixed',
                top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
                right: 14,
                zIndex: 50,
                padding: '8px 16px',
                borderRadius: 999,
                fontFamily: "'Cinzel', Georgia, serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #b13030, #5b1818)',
                border: '1px solid #8b2121',
                color: '#f5ead0',
                boxShadow: '0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
                cursor: 'pointer',
              }}
            >
              {t('actions.leave')}
            </button>
          )}
        </div>
      </MotionConfig>
    );
  }

  // Non-game shell: bottom nav + page content
  return (
    <MotionConfig reducedMotion={settings.animations ? 'never' : 'always'}>
      <div
        style={{ minHeight: '100dvh', color: '#f5ead0', display: 'flex', flexDirection: 'column' }}
      >
        {/* Global Desktop Header */}
        {isDesktop && (
          <header
            className="px-8 py-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-40 select-none"
            style={{
              background: 'linear-gradient(180deg, rgba(42,10,10,0.92), rgba(20,5,5,0.96))',
              borderColor: 'rgba(212,175,55,0.22)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo.png" alt="Muushig Logo" className="w-9 h-9 object-contain" />
              <span
                className="text-2xl font-black font-display uppercase tracking-widest"
                style={{
                  backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Muushig
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8 font-display font-bold text-sm tracking-wider">
              <button
                onClick={() => setNavTab('home')}
                className="bg-transparent border-none cursor-pointer transition uppercase"
                style={{ color: navTab === 'home' ? colors.gold[300] : 'rgba(216,200,156,0.8)' }}
              >
                Home
              </button>
              <button
                onClick={() => setNavTab('profile')}
                className="bg-transparent border-none cursor-pointer transition uppercase"
                style={{ color: navTab === 'profile' ? colors.gold[300] : 'rgba(216,200,156,0.8)' }}
              >
                Stats
              </button>
              <button
                onClick={() => setNavTab('shop')}
                className="bg-transparent border-none cursor-pointer transition uppercase"
                style={{ color: navTab === 'shop' ? colors.gold[300] : 'rgba(216,200,156,0.8)' }}
              >
                Shop
              </button>
              <button
                onClick={() => setNavTab('settings')}
                className="bg-transparent border-none cursor-pointer transition uppercase"
                style={{
                  color: navTab === 'settings' ? colors.gold[300] : 'rgba(216,200,156,0.8)',
                }}
              >
                Settings
              </button>
            </div>

            {/* Profile badge */}
            <div className="flex items-center gap-2 bg-black/35 px-4 py-1.5 rounded-full border border-[rgba(212,175,55,0.22)] select-none">
              <img
                src={browserAuth?.avatarUrl || '/assets/mongolian_boy.png'}
                alt=""
                className="w-5.5 h-5.5 rounded-full object-cover border border-[#d4af37]"
              />
              <span className="text-white text-xs font-semibold">
                {browserAuth?.username || 'Guest'}
              </span>
            </div>
          </header>
        )}

        {/* Floating circular gold How to Play button */}
        {isDesktop && (
          <button
            onClick={() => setShowRulesModal(true)}
            className="fixed top-22 left-6 z-40 w-10 h-10 rounded-full border-2 bg-black/40 flex items-center justify-center font-bold text-lg cursor-pointer transition hover:scale-105 active:scale-95"
            style={{
              borderColor: colors.gold[500],
              color: colors.gold[300],
              boxShadow: shadows.low,
            }}
            title="How to Play"
          >
            ?
          </button>
        )}

        {/* Rules Modal Overlay */}
        <AnimatePresence>
          {showRulesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-3xl rounded-3xl border p-6 overflow-hidden flex flex-col"
                style={{
                  background: gradients.velvet,
                  borderColor: colors.gold[500],
                  boxShadow: shadows.deep,
                  maxHeight: '80vh',
                }}
              >
                {/* Header inside modal */}
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(212,175,55,0.22)] mb-4">
                  <h2 className="text-xl font-black font-display text-[rgba(216,200,156,0.9)] uppercase tracking-wider m-0">
                    How to Play
                  </h2>
                  <button
                    onClick={() => setShowRulesModal(false)}
                    className="w-8 h-8 rounded-full border border-[rgba(212,175,55,0.3)] bg-transparent hover:bg-white/10 text-white flex items-center justify-center cursor-pointer text-sm font-semibold transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Scrollable rules list */}
                <div className="overflow-y-auto pr-2 flex-1">
                  <RulesPage />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <SpringScroll style={{ flex: 1 }}>
          {isReconnecting ? (
            <ConnectingSplash label={t('status.reconnecting')} />
          ) : navTab === 'shop' ? (
            <ShopPage />
          ) : navTab === 'profile' ? (
            <ProfilePage />
          ) : navTab === 'rules' ? (
            <RulesPage />
          ) : navTab === 'settings' ? (
            <SettingsPage
              onNavigate={(tab) => setNavTab(tab as NavTab)}
              onShowRules={() => setShowRulesModal(true)}
            />
          ) : isEmbedded ? (
            <ConnectingSplash label={t('status.connecting')} />
          ) : (
            <HomePage
              discordId={activeDiscordId}
              userId={activeUserId}
              username={activeUsername}
              avatarUrl={activeAvatarUrl}
              error={error && !isConnected ? error : null}
            />
          )}
        </SpringScroll>

        {/* Casino bottom nav */}
        <nav
          className="safe-pb"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            display: isDesktop ? 'none' : 'flex',
            background: 'linear-gradient(180deg, rgba(7,38,26,0.92), rgba(4,21,14,0.98))',
            borderTop: '1px solid rgba(212,175,55,0.4)',
            backdropFilter: 'blur(14px)',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {(
            [
              { key: 'home', label: t('nav.play'), icon: 'nav_play.png', emoji: null },
              { key: 'rules', label: t('nav.rules'), icon: null, emoji: '📖' },
              { key: 'shop', label: t('nav.shop'), icon: 'nav_shop.png', emoji: null },
              { key: 'profile', label: t('nav.profile'), icon: 'nav_profile.png', emoji: null },
              { key: 'settings', label: t('nav.settings'), icon: null, emoji: '⚙️' },
            ] as { key: NavTab; label: string; icon: string | null; emoji: string | null }[]
          ).map((tab) => {
            const active = navTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setNavTab(tab.key)}
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '9px 0 11px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: active ? '#f4d774' : 'rgba(216,200,156,0.5)',
                  textShadow: active ? '0 0 10px rgba(212,175,55,0.5)' : undefined,
                  transition: 'color 0.2s',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: active ? 'drop-shadow(0 0 8px rgba(212,175,55,0.7))' : 'none',
                    opacity: active ? 1 : 0.55,
                    transition: 'opacity 0.2s, filter 0.2s',
                    fontSize: tab.emoji ? 18 : undefined,
                  }}
                >
                  {tab.icon ? (
                    <img
                      src={`/assets/nav/${tab.icon}`}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    tab.emoji
                  )}
                </span>
                <span>{tab.label}</span>
                {active && (
                  <motion.span
                    layoutId="activeNavTabIndicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '25%',
                      right: '25%',
                      height: 2.5,
                      background:
                        'linear-gradient(90deg, transparent, #fce28a 15%, #d4af37 50%, #fce28a 85%, transparent)',
                      boxShadow: '0 0 12px rgba(212,175,55,0.85)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </MotionConfig>
  );
}

function App() {
  const { t } = useTranslation('common');
  const [auth, setAuth] = useState<DiscordAuthInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isEmbedded) {
      setupDiscordSdk()
        .then((discordAuth) => {
          setAuth(discordAuth);
        })
        .catch((e) => {
          console.error('Discord SDK setup failed:', e);
          setAuthError(e.message);
        });
    }
  }, []);

  return (
    <ErrorBoundary>
      <>
        {authError && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              padding: '10px 14px',
              textAlign: 'center',
              fontSize: 12,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 600,
              color: '#f5ead0',
              background: 'linear-gradient(180deg, #5b1818 0%, #2a0a0a 100%)',
              borderBottom: '1px solid #8b2121',
              boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
            }}
          >
            {t('errors.discordActivityFailed', { message: authError })}
          </div>
        )}
        <Game discordAuth={auth} />
      </>
    </ErrorBoundary>
  );
}

export default App;
