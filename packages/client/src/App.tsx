import { useGame } from './contexts/GameContext';
import { useEffect, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { Lobby } from './components/Lobby';
import { isEmbedded, setupDiscordSdk, discordSdk, type DiscordAuthInfo } from './discordAuth';
import { useAuth } from './contexts/AuthContext';
import './App.css';

function Game({ discordAuth }: { discordAuth?: DiscordAuthInfo | null }) {
  const { room, isConnected, isReconnecting, error, leaveGame, autoJoinDiscordRoom, gameState } =
    useGame();
  const { user: browserAuth, handleOAuthCallback } = useAuth();

  // Handle Discord OAuth callback (?code=...) for browser login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !isEmbedded) {
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

  if (isWaitingPhase) {
    return <GameBoard />;
  }

  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col p-4 md:p-8 relative safe-p">
      <header className="flex justify-between items-center mb-6 border-b border-green-800 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
          ♦ Durak <span className="text-yellow-400">Online</span> ♦
        </h1>
        {isConnected && room && (
          <div className="flex space-x-4 items-center">
            <div className="bg-black/50 px-4 py-2 rounded-full text-xs font-mono shadow-inner border border-white/10 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]"></div>
              <span>
                Room: <span className="text-yellow-300 font-bold">{room.id}</span>
              </span>
            </div>
            <button
              onClick={leaveGame}
              className="bg-red-900/50 hover:bg-red-800 text-red-100 px-3 py-1 rounded text-sm transition"
            >
              Leave Game
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-2 pt-0 w-full overflow-x-hidden relative z-10">
        {error && !isConnected && (
          <div className="w-full text-center text-red-400 font-bold mb-4 bg-red-900/30 p-2 rounded">
            Error: {error}
          </div>
        )}

        {isReconnecting ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-sm">
              Reconnecting…
            </div>
          </div>
        ) : !isConnected ? (
          isEmbedded ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-green-400 font-bold animate-pulse uppercase tracking-widest text-sm">
                Connecting to Discord
              </div>
            </div>
          ) : (
            <Lobby
              discordId={activeDiscordId}
              userId={activeUserId}
              username={activeUsername}
              avatarUrl={activeAvatarUrl}
            />
          )
        ) : (
          <GameBoard />
        )}
      </main>

      <footer className="mt-4 text-center text-green-700 text-xs">
        © {new Date().getFullYear()} Durak Online — Multiplayer Framework Built with Colyseus.js ·{' '}
        <a href="/privacy.html" className="underline hover:text-green-400">
          Privacy
        </a>{' '}
        ·{' '}
        <a href="/terms.html" className="underline hover:text-green-400">
          Terms
        </a>
      </footer>
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
    <>
      {authError && (
        <div className="bg-red-900/90 text-white p-2 text-center text-xs w-full fixed top-0 z-50">
          Failed to connect to Discord Activity: {authError}
        </div>
      )}
      <Game discordAuth={auth} />
    </>
  );
}

export default App;
