import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { GuidedHand } from './GuidedHand';

/**
 * Watching a private table (an invitation preview or a late arrival): ask for a
 * seat. The server seats people in arrival order when a seat is free between games.
 */
export function SeatRequest({ playerName, preset }: { playerName: string; preset: string }) {
  const game = useGame();
  const [guided, setGuided] = useState(false);
  const state = game.gameState;
  const session = game.room?.sessionId;
  if (!state || !session || !state.isPrivate || !game.isSpectator) return null;
  const line = Array.from(state.seatRequests).filter((r) => !!r);
  const place = line.findIndex((r) => r.id === session);
  const free = state.maxPlayers - state.players.size;
  const between = state.phase === 'waiting' || state.phase === 'finished';
  if (place !== -1)
    return (
      <div className="seat-request" role="status">
        <p>
          <strong>
            {place === 0 ? 'You’re next in line for a seat.' : `You’re #${place + 1} in line.`}
          </strong>{' '}
          {free > 0 && between
            ? 'Taking your seat…'
            : free > 0
              ? 'You’ll be seated when this game ends.'
              : 'The table is full. You’ll be seated when a seat opens.'}
        </p>
        <button className="quiet-button" onClick={() => game.room?.send('cancelSeatRequest')}>
          Leave the line
        </button>
      </div>
    );
  return (
    <div className="seat-request">
      <p>
        {free > 0
          ? `${free} ${free === 1 ? 'seat is' : 'seats are'} open.`
          : 'Every seat is taken. Get in line for the next one.'}
      </p>
      <button
        className="primary-button"
        onClick={() =>
          game.room?.send('requestSeat', { username: playerName, avatarPreset: preset })
        }
      >
        {free > 0 && between && line.length === 0 ? 'Join the table' : 'Join next game'}
        <span aria-hidden="true">♠</span>
      </button>
      {/* The watcher stays connected, so the invitation is kept while practicing. */}
      <button className="quiet-button" onClick={() => setGuided(true)}>
        Try a guided hand first
      </button>
      {guided && <GuidedHand close={() => setGuided(false)} finishLabel="Back to the table" />}
    </div>
  );
}
