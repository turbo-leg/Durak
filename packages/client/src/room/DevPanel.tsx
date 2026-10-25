import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { RANKS, SUITS } from '../game/cardGlyphs';
import './dev-panel.css';

/**
 * Developer tools, only in dev builds (CardRoom loads this lazily behind
 * `import.meta.env.DEV`). Toggle with the backtick key. Everything here goes through the
 * same room messages as the real UI; the server refuses the debug-only ones in production.
 */

type Stats = Record<'fps' | 'renderCalls' | 'geometries' | 'textures' | 'avatarCount', string>;
type BotHand = {
  id: string;
  username: string;
  cards: Array<{ suit: string; rank: number; isJoker: boolean }>;
};
const OPEN_KEY = 'durak_dev_panel';

/** The 3D table's renderer counters, sampled once a second. */
function useRendererStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let last = { frames: 0, at: performance.now() };
    const sample = () => {
      const host = document.querySelector<HTMLElement>('[data-testid="three-table"]');
      if (!host?.dataset.frames) return setStats(null);
      const frames = Number(host.dataset.frames);
      const at = performance.now();
      const fps = ((frames - last.frames) * 1000) / Math.max(1, at - last.at);
      last = { frames, at };
      setStats({
        fps: fps.toFixed(0),
        renderCalls: host.dataset.renderCalls ?? '–',
        geometries: host.dataset.geometries ?? '–',
        textures: host.dataset.textures ?? '–',
        avatarCount: host.dataset.avatarCount ?? '–',
      });
    };
    const timer = setInterval(sample, 1000);
    return () => clearInterval(timer);
  }, []);
  return stats;
}

export default function DevPanel() {
  const game = useGame();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [note, setNote] = useState('');
  const [botHands, setBotHands] = useState<{ roomId: string; hands: BotHand[] }>({
    roomId: '',
    hands: [],
  });
  const stats = useRendererStats();
  const { room, gameState: state } = game;
  const players = state ? Array.from(state.players.values()) : [];
  const host = Boolean(room && state && room.sessionId === state.hostId);
  const canPeek = Boolean(
    room && state?.isPrivate && state.players.get(room.sessionId)?.control === 'human',
  );
  const empty = state ? state.maxPlayers - players.length : 0;
  const visibleBotHands = botHands.roomId === room?.roomId ? botHands.hands : [];

  useEffect(() => {
    if (!open || !room || !canPeek) return;
    const off = room.onMessage('dev_bot_hands', (data: { hands: BotHand[] }) => {
      setBotHands({ roomId: room.roomId, hands: data.hands });
    });
    const refresh = () => room.send('dev_action', { action: 'peek_bot_hands' });
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, [open, room, canPeek]);

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      // Typing a backtick into a field is just typing.
      const typing =
        event.target instanceof HTMLElement && event.target.closest('input, textarea, select');
      if (event.key !== '`' || typing) return;
      setOpen((value) => {
        try {
          localStorage.setItem(OPEN_KEY, value ? '0' : '1');
        } catch {
          // Storage may be unavailable; the panel still toggles for this page.
        }
        return !value;
      });
    };
    addEventListener('keydown', toggle);
    return () => removeEventListener('keydown', toggle);
  }, []);

  if (!open) return null;

  const flash = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(''), 2000);
  };
  const addBots = (count: number, difficulty: 'easy' | 'hard' | 'dummy') => {
    if (!room || !state) return;
    // Private tables add bots one at a time; public lobbies take the dev spawn action.
    if (state.isPrivate && difficulty !== 'dummy')
      for (let i = 0; i < count; i++) room.send('addBot', { difficulty });
    else room.send('dev_action', { action: 'spawn_dummies', difficulty, count });
  };
  const copyState = async () => {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.toJSON(), null, 2));
      flash('State copied');
    } catch {
      flash('Clipboard unavailable');
    }
  };

  return (
    <aside className="dev-panel" aria-label="Developer tools">
      <header>
        <strong>Dev tools</strong>
        <small>` to close</small>
      </header>

      {!room && (
        <section>
          <button
            onClick={() =>
              void game.createGame({
                username: 'Dev',
                maxPlayers: 6,
                handSize: 5,
                mode: 'classic',
                isPrivate: true,
              })
            }
          >
            New private table (6 seats)
          </button>
          <p>Then fill it with bots and start.</p>
        </section>
      )}

      {room && state && (
        <>
          <section>
            <dl>
              <dt>Room</dt>
              <dd>
                {room.roomId} {state.isPrivate ? '(private)' : '(public)'}
              </dd>
              <dt>Phase</dt>
              <dd>
                {state.phase} · {state.mode} · {state.targetHandSize} cards
              </dd>
              <dt>Turn</dt>
              <dd>{state.players.get(state.currentTurn)?.username || '–'}</dd>
              <dt>Deck</dt>
              <dd>{state.deckCount}</dd>
            </dl>
          </section>
          <section>
            <table>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id}>
                    <td>
                      {player.id === room.sessionId ? '▶ ' : ''}
                      {player.username || player.id}
                    </td>
                    <td>{player.control}</td>
                    <td>{player.handCount} cards</td>
                    <td>{player.connected ? '' : 'away'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {state.isPrivate && (
            <section aria-label="Bot hands">
              <strong>Bot hands</strong>
              {!canPeek ? <p>Join as a player to inspect bot cards.</p> : null}
              {canPeek && visibleBotHands.length === 0 ? <p>No bot cards to show.</p> : null}
              {visibleBotHands.map((bot) => (
                <div className="dev-bot-hand" key={bot.id}>
                  <span>{bot.username || bot.id}</span>
                  <div className="dev-bot-cards">
                    {bot.cards.length === 0 ? <span>Empty hand</span> : null}
                    {bot.cards.map((card, index) => (
                      <span
                        className={
                          card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 18
                            ? 'dev-bot-card red'
                            : 'dev-bot-card'
                        }
                        key={`${card.suit}-${card.rank}-${index}`}
                      >
                        {RANKS[card.rank] || card.rank}
                        {SUITS[card.suit] || card.suit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          <section className="dev-panel-actions">
            <button disabled={!host || empty <= 0} onClick={() => addBots(empty, 'easy')}>
              Fill with easy bots
            </button>
            <button disabled={!host || empty <= 0} onClick={() => addBots(empty, 'hard')}>
              Fill with hard bots
            </button>
            <button disabled={!host || empty <= 0} onClick={() => addBots(1, 'dummy')}>
              Add a dummy
            </button>
            <button
              disabled={!host || state.phase !== 'waiting'}
              onClick={() => game.startLobbyGame()}
            >
              Start game
            </button>
            <button
              disabled={!host || state.phase !== 'playing'}
              onClick={() => room.send('dev_action', { action: 'force_pass' })}
            >
              Force the turn on
            </button>
            <button onClick={() => void copyState()}>Copy state JSON</button>
          </section>
        </>
      )}

      <section>
        {stats ? (
          <dl>
            <dt>Frames</dt>
            <dd>{stats.fps}/s</dd>
            <dt>Draw calls</dt>
            <dd>{stats.renderCalls}</dd>
            <dt>Geometries</dt>
            <dd>{stats.geometries}</dd>
            <dt>Textures</dt>
            <dd>{stats.textures}</dd>
            <dt>Avatars</dt>
            <dd>{stats.avatarCount}</dd>
          </dl>
        ) : (
          <p>No 3D table on screen.</p>
        )}
        <a href="/character.html" target="_blank" rel="noreferrer">
          Character preview ↗
        </a>
      </section>
      {note && <p role="status">{note}</p>}
    </aside>
  );
}
