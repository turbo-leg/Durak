import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import './dev-panel.css';

/**
 * Developer tools, only in dev builds (CardRoom loads this lazily behind
 * `import.meta.env.DEV`). Toggle with the backtick key. Everything here goes through the
 * same room messages as the real UI; the server refuses the debug-only ones in production.
 */

type Stats = Record<'fps' | 'renderCalls' | 'geometries' | 'textures' | 'avatarCount', string>;
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
  const stats = useRendererStats();

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

  const { room, gameState: state } = game;
  const players = state ? Array.from(state.players.values()) : [];
  const host = Boolean(room && state && room.sessionId === state.hostId);
  const empty = state ? state.maxPlayers - players.length : 0;
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
