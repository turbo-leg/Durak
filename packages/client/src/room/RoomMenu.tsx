import { useState } from 'react';
import type { RoomAvailable } from 'colyseus.js';
import { useGame } from '../contexts/GameContext';
import { invitationLink, parseInvitation } from '../game/invitation';
import { GuidedHand } from './GuidedHand';
import { TeamBoard } from './TeamBoard';

export function RoomMenu({
  playerName,
  name,
  setName,
  signedIn,
  avatarPicker,
}: {
  playerName: string;
  name: string;
  setName: (name: string) => void;
  signedIn: boolean;
  avatarPicker?: React.ReactNode;
}) {
  const game = useGame();
  const [tab, setTab] = useState<'solo' | 'friends' | 'public'>('friends');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('classic');
  const [seats, setSeats] = useState(2);
  const [handSize, setHandSize] = useState(5);
  const [teamSelection, setTeamSelection] = useState('random');
  const [difficulty, setDifficulty] = useState('easy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [guided, setGuided] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const refresh = () =>
    run(async () => {
      setRooms(await game.findPublicGames());
    });
  const options = { username: playerName, mode, maxPlayers: seats, handSize, teamSelection };
  // An invitation opens the table as a preview first; the guest then takes a seat there.
  const openInvitation = async (input: string) => {
    const table = parseInvitation(input);
    if (!table) throw new Error('Paste an invitation link or a room code.');
    await game.spectateGame(table);
  };
  return (
    <section className="play-dock" aria-label="Choose a game">
      <div className="dock-title">
        <h2>Start a game</h2>
        <span>2–6 players</span>
      </div>
      <div
        className="dock-tabs"
        role="tablist"
        aria-label="Game type"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const index =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 2
                : (current + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
          buttons[index]?.focus();
          buttons[index]?.click();
        }}
      >
        {(['friends', 'solo', 'public'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls="game-setup"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => {
              setTab(t);
              if (t === 'public') void refresh();
            }}
          >
            {t === 'solo' ? 'Practice' : t === 'friends' ? 'With friends' : 'Open tables'}
          </button>
        ))}
      </div>
      <div
        className="game-setup"
        id="game-setup"
        role="tabpanel"
        aria-label={
          tab === 'solo' ? 'Practice' : tab === 'friends' ? 'With friends' : 'Open tables'
        }
      >
        {!signedIn && (
          <label className="field setup-name">
            Your table name
            <input
              maxLength={28}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest"
            />
          </label>
        )}
        <div className="setup-avatar">{avatarPicker}</div>
        {tab === 'solo' ? (
          <>
            <p className="dock-description">
              A seat is ready. Get a feel for the cards against a bot.
            </p>
            <div className="difficulty-options">
              <button aria-pressed={difficulty === 'easy'} onClick={() => setDifficulty('easy')}>
                Easy<span>Find your rhythm</span>
              </button>
              <button aria-pressed={difficulty === 'hard'} onClick={() => setDifficulty('hard')}>
                Hard<span>Make it a match</span>
              </button>
            </div>
            <button
              className="primary-button"
              disabled={busy || game.isReconnecting}
              onClick={() =>
                void run(() =>
                  game.createGame({
                    username: playerName,
                    maxPlayers: 2,
                    handSize: 5,
                    mode: 'classic',
                    isPrivate: true,
                    botDifficulty: difficulty,
                  }),
                )
              }
            >
              {busy ? 'Taking your seat…' : 'Practice against a bot'}
              <span aria-hidden="true">♠</span>
            </button>
          </>
        ) : tab === 'friends' ? (
          <>
            <div className="format-options setup-format" aria-label="Match format">
              {(['1v1', '2v2', '3v3', 'Free-for-all'] as const).map((format) => {
                const active =
                  mode !== 'classic'
                    ? seats === 4
                      ? '2v2'
                      : '3v3'
                    : seats === 2
                      ? '1v1'
                      : 'Free-for-all';
                return (
                  <button
                    type="button"
                    key={format}
                    aria-pressed={format === active}
                    onClick={() => {
                      setMode(format === '2v2' || format === '3v3' ? 'teams' : 'classic');
                      if (format === '2v2' || format === '3v3') setTeamSelection('manual');
                      setSeats(
                        format === '2v2' ? 4 : format === '3v3' ? 6 : format === '1v1' ? 2 : 3,
                      );
                    }}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
            <div className="settings-row setup-settings">
              <label className="field">
                Game
                <select
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    if (e.target.value !== 'classic' && ![4, 6].includes(seats)) setSeats(4);
                  }}
                >
                  <option value="classic">Classic</option>
                  <option value="teams">Teams</option>
                  <option value="horse">Horse</option>
                </select>
              </label>
              <label className="field">
                Seats
                <select value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                  {(mode === 'classic' ? [2, 3, 4, 5, 6] : [4, 6]).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Hand
                <select value={handSize} onChange={(e) => setHandSize(Number(e.target.value))}>
                  <option>5</option>
                  <option>7</option>
                </select>
              </label>
            </div>
            {mode !== 'classic' && (
              <p className="team-setup-note">
                {mode === 'horse'
                  ? 'Two teams play a series. Each loss adds a letter to HORSE.'
                  : 'Blue and Red take alternating seats. The first player out wins for their whole team.'}
              </p>
            )}
            {mode !== 'classic' && (
              <label className="field setup-teams">
                Teams
                <select value={teamSelection} onChange={(e) => setTeamSelection(e.target.value)}>
                  <option value="random">Random teams</option>
                  <option value="manual">Choose teams</option>
                </select>
              </label>
            )}
            <p className="quick-match-summary">
              {mode === 'classic' ? 'Classic' : mode === 'horse' ? 'Horse' : 'Teams'} game · {seats}{' '}
              players · {handSize} cards each
            </p>
            <button
              className="primary-button create-table-button"
              disabled={busy}
              onClick={() => void run(() => game.createGame({ ...options, isPrivate: true }))}
            >
              Create a table<span aria-hidden="true">+</span>
            </button>
            <div className="join-row">
              <label className="field">
                Join friends
                <input
                  aria-label="Invitation link or room code"
                  value={code}
                  maxLength={64}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste invitation link or code"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy && code.trim()) {
                      event.preventDefault();
                      void run(() => openInvitation(code));
                    }
                  }}
                />
              </label>
              <button
                className="secondary-button"
                disabled={busy || !code.trim()}
                onClick={() => void run(() => openInvitation(code))}
              >
                Join
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dock-description">Find a table, or open one for other players.</p>
            <div className="open-rooms">
              {rooms.length ? (
                rooms.map((r) => (
                  <div key={r.roomId}>
                    <span>
                      {String(r.metadata?.mode || 'Classic')}
                      <small>
                        {r.clients}/{r.maxClients} seated
                      </small>
                    </span>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => game.joinGame(r.roomId, undefined, undefined, playerName))
                      }
                    >
                      Join
                    </button>
                    <button
                      className="quiet-button"
                      disabled={busy}
                      onClick={() => void run(() => game.spectateGame(r.roomId))}
                    >
                      Watch
                    </button>
                  </div>
                ))
              ) : (
                <p role="status">
                  {busy ? 'Looking for open tables…' : 'No open tables yet. Start the next one.'}
                </p>
              )}
            </div>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  game.joinOrCreateGame({
                    ...options,
                    mode: 'classic',
                    maxPlayers: 2,
                    isPrivate: false,
                  }),
                )
              }
            >
              Find a match<span aria-hidden="true">♣</span>
            </button>
            <button
              className="quiet-button full-width"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh tables
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {tab !== 'public' && (
          <button className="quiet-button full-width" onClick={() => setGuided(true)}>
            New to our rules? Try a guided hand
          </button>
        )}
        {guided && <GuidedHand close={() => setGuided(false)} />}
        <p className="dock-footnote">Our rules. 42 cards. No one wants to be the Durak.</p>
      </div>
    </section>
  );
}

export function RoomLobby({
  onNotice,
  avatarPicker,
  countdownSeconds = 0,
  seatRequest,
}: {
  onNotice: (message: string) => void;
  avatarPicker?: React.ReactNode;
  countdownSeconds?: number;
  seatRequest?: React.ReactNode;
}) {
  const game = useGame();
  const state = game.gameState!;
  const session = game.room!.sessionId;
  const host = state.hostId === session;
  const me = state.players.get(session);
  const players = Array.from(state.players.values());
  const humans = players.filter((p) => p.control === 'human');
  const empty = state.maxPlayers - players.length;
  const blue = players.filter((p) => p.team === 0).length;
  // Mirrors the server's start conditions so people know what the table waits for.
  const waitingFor =
    empty > 0
      ? `Waiting for ${empty} more ${empty === 1 ? 'player' : 'players'}.`
      : state.mode !== 'classic' && state.teamSelection === 'manual' && blue * 2 !== players.length
        ? 'Teams must be balanced before the deal.'
        : humans.some((p) => !p.isReady)
          ? 'Starts when everyone is ready.'
          : '';
  const countdown = state.phase === 'countdown';
  return (
    <section className="play-dock lobby-dock">
      <div className="dock-title">
        <h2>{game.isSpectator ? 'Watching a table' : 'Your table'}</h2>
        <span>
          {state.players.size}/{state.maxPlayers} seated
        </span>
      </div>
      <p className="dock-description">
        {game.isSpectator
          ? 'You’re watching. Take a seat when you’re ready.'
          : state.isPrivate
            ? 'Share this link to invite your friends.'
            : 'Share this code to invite more players.'}
      </p>
      <button
        className="invitation-code"
        onClick={async () => {
          const text = state.isPrivate ? invitationLink(game.room!.roomId) : game.room!.roomId;
          try {
            await navigator.clipboard.writeText(text);
            onNotice(
              state.isPrivate
                ? 'Invitation link copied. Send it to your friends.'
                : 'Room code copied. Send it to your friends.',
            );
          } catch {
            onNotice(
              state.isPrivate
                ? `Copy this invitation link: ${text} (room code ${game.room!.roomId})`
                : `Copy this room code: ${text}`,
            );
          }
        }}
        aria-label={state.isPrivate ? 'Copy invitation link' : 'Copy room code'}
      >
        {game.room!.roomId}
        <small>{state.isPrivate ? 'Copy invitation link' : 'Copy code'}</small>
      </button>
      {state.isPrivate && (
        <p className="dock-description" role="status">
          {countdown ? `Dealing in ${countdownSeconds}…` : waitingFor}
        </p>
      )}
      {state.mode !== 'classic' && (
        <TeamBoard
          state={state}
          sessionId={session}
          variant="lobby"
          spectator={game.isSpectator}
          host={host}
          onJoinTeam={(team) => game.room?.send('switchTeam', { team })}
          onRemoveBot={(id) => game.room?.send('removeBot', { playerId: id })}
        />
      )}
      {state.mode === 'classic' && (
        <ul className="lobby-players" aria-label="Players at this table">
          {Array.from(state.players.values()).map((p) => (
            <li key={p.id}>
              <span className="avatar">{(p.username || 'G')[0]}</span>
              <span>
                {p.id === session ? `${p.username || 'Guest'} (you)` : p.username || 'Guest'}
              </span>
              <span className={p.isReady ? 'ready-state' : 'not-ready'}>
                {p.control !== 'human' ? 'Bot ready' : p.isReady ? 'Ready' : 'Not ready'}
              </span>
              {host && p.control === 'bot' && (
                <button
                  className="quiet-button"
                  aria-label={`Remove ${p.username || 'bot'}`}
                  onClick={() => game.room?.send('removeBot', { playerId: p.id })}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: Math.max(0, empty) }, (_, i) => (
            <li key={`empty-${i}`} className="empty-seat">
              <span className="avatar" aria-hidden="true">
                ·
              </span>
              <span>Open seat</span>
            </li>
          ))}
        </ul>
      )}
      {!game.isSpectator && (
        <div className="lobby-actions">
          <button
            className={me?.isReady ? 'secondary-button full-width' : 'primary-button'}
            onClick={() => game.room?.send('toggleReady', { isReady: !me?.isReady })}
          >
            {me?.isReady ? 'Not ready yet' : 'Ready to play'}
          </button>
          {host && state.isPrivate && (
            <button
              className="quiet-button full-width"
              disabled={empty <= 0}
              onClick={() => game.room?.send('addBot', { difficulty: 'easy' })}
            >
              Add a bot
            </button>
          )}
          {host && !state.isPrivate && (
            <>
              <button
                className="quiet-button full-width"
                disabled={empty <= 0}
                onClick={() =>
                  game.room?.send('dev_action', {
                    action: 'spawn_dummies',
                    difficulty: 'easy',
                    count: 1,
                  })
                }
              >
                Add a bot
              </button>
              <button
                className="primary-button"
                disabled={
                  players.length < 2 ||
                  (state.mode !== 'classic' && ![4, 6].includes(players.length)) ||
                  players.some((p) => !p.isReady)
                }
                onClick={game.startLobbyGame}
              >
                Start the game<span aria-hidden="true">♠</span>
              </button>
            </>
          )}
        </div>
      )}
      {game.isSpectator && seatRequest}
      {avatarPicker && (
        <details className="lobby-customize">
          <summary>Change character</summary>
          {avatarPicker}
        </details>
      )}
      <p className="dock-footnote">
        {!state.isPrivate
          ? host
            ? 'You host this table.'
            : 'The host starts when everyone is ready.'
          : host
            ? 'You host this table. The game starts by itself when every seat is ready.'
            : 'The game starts by itself when every seat is ready.'}
      </p>
    </section>
  );
}
