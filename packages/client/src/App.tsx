import { useEffect, useRef, useState } from 'react';
import { clearInvitationFromUrl, invitedTableId } from './game/invitation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import { useGame } from './contexts/GameContext';
import { discordSdk, isEmbedded, setupDiscordSdk, type DiscordAuthInfo } from './discordAuth';
import { CardRoom } from './room/CardRoom';

function ConnectedRoom() {
  const [auth, setAuth] = useState<DiscordAuthInfo | null>(null);
  const [authError, setAuthError] = useState(() => {
    const params = new URLSearchParams(location.search);
    return !isEmbedded && params.has('error')
      ? params.get('error_description') || 'Discord sign-in was cancelled.'
      : '';
  });
  const { handleOAuthCallback } = useAuth();
  const { autoJoinDiscordRoom, isConnected, isReconnecting, room, spectateGame } = useGame();
  const invitationOpened = useRef(false);
  useEffect(() => {
    // An invitation link opens the table as a preview: format, occupants and phase,
    // before the guest chooses to take a seat. A saved seat (refresh) takes priority.
    if (isEmbedded || invitationOpened.current) return;
    invitationOpened.current = true;
    const table = invitedTableId();
    if (!table || sessionStorage.getItem('durak_reconnection_token')) return;
    void spectateGame(table).finally(clearInvitationFromUrl);
  }, [spectateGame]);
  useEffect(() => {
    if (isEmbedded) {
      setupDiscordSdk()
        .then(setAuth)
        .catch((error: Error) => setAuthError(error.message));
    } else {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      if (code) void handleOAuthCallback(code);
      if (params.has('error')) {
        history.replaceState({}, '', location.pathname);
      }
    }
  }, [handleOAuthCallback]);
  useEffect(() => {
    if (!auth || !discordSdk?.instanceId || isConnected || isReconnecting || room) return;
    const u = auth.user;
    void autoJoinDiscordRoom(
      discordSdk.instanceId,
      u.global_name || u.username,
      u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : '',
      u.id,
    );
  }, [auth, autoJoinDiscordRoom, isConnected, isReconnecting, room]);
  return (
    <CardRoom embeddedName={auth?.user.global_name || auth?.user.username} authError={authError} />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConnectedRoom />
    </ErrorBoundary>
  );
}
