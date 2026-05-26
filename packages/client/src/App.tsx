import { useGame } from './contexts/GameContext';
import { useEffect, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { Lobby } from './components/Lobby';
import { ShopPage } from './components/ShopPage';
import { ProfilePage } from './components/ProfilePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isEmbedded, setupDiscordSdk, discordSdk, type DiscordAuthInfo } from './discordAuth';
import { useAuth } from './contexts/AuthContext';
import './App.css';

type NavTab = 'home' | 'shop' | 'profile';

function Game({ discordAuth }: { discordAuth?: DiscordAuthInfo | null }) {
  const { room, isConnected, isReconnecting, error, leaveGame, autoJoinDiscordRoom, gameState } =
    useGame();
  const { user: browserAuth, handleOAuthCallback } = useAuth();
  const [navTab, setNavTab] = useState<NavTab>('home');

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
      <div className="relative">
        <GameBoard />
        {isConnected && room && (
          <button
            onClick={leaveGame}
            className="fixed top-4 right-4 z-50 bg-red-900/80 hover:bg-red-800 text-red-100 px-3 py-1 rounded text-sm transition shadow-lg"
          >
            Leave
          </button>
        )}
      </div>
    );
  }

  // Non-game shell: bottom nav + page content
  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col">
      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {isReconnecting ? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-sm">
              Reconnecting…
            </div>
          </div>
        ) : navTab === 'shop' ? (
          <ShopPage />
        ) : navTab === 'profile' ? (
          <ProfilePage />
        ) : isEmbedded ? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-green-400 font-bold animate-pulse uppercase tracking-widest text-sm">
              Connecting to Discord
            </div>
          </div>
        ) : (
          <div className="min-h-screen bg-green-950 flex flex-col">
            <header className="flex justify-between items-center px-4 pt-6 pb-4 border-b border-green-800">
              <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
                ♦ Durak <span className="text-yellow-400">Online</span> ♦
              </h1>
              {error && !isConnected && (
                <span className="text-red-400 text-xs font-bold">{error}</span>
              )}
            </header>
            <main className="flex-1 flex flex-col items-center justify-center p-4 w-full overflow-x-hidden">
              <Lobby
                discordId={activeDiscordId}
                userId={activeUserId}
                username={activeUsername}
                avatarUrl={activeAvatarUrl}
              />
            </main>
          </div>
        )}
      </div>

      {/* Bottom nav bar — hidden while in a game */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-indigo-950/95 backdrop-blur border-t border-indigo-800 flex safe-pb">
        {(
          [
            { key: 'home', label: 'Play', icon: '♠' },
            { key: 'shop', label: 'Shop', icon: '🛒' },
            { key: 'profile', label: 'Profile', icon: '👤' },
          ] as { key: NavTab; label: string; icon: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setNavTab(tab.key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-semibold transition ${
              navTab === tab.key ? 'text-white' : 'text-indigo-500 hover:text-indigo-300'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
            {navTab === tab.key && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-indigo-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

function App() {
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
          <div className="bg-red-900/90 text-white p-2 text-center text-xs w-full fixed top-0 z-50">
            Failed to connect to Discord Activity: {authError}
          </div>
        )}
        <Game discordAuth={auth} />
      </>
    </ErrorBoundary>
  );
}

export default App;
