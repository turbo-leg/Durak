import type { GameState, Player } from '@durak/shared';

type Variant = 'lobby' | 'playing' | 'result';

const teamNames = ['Blue', 'Red'] as const;

function playerStatus(player: Player, variant: Variant, active: boolean) {
  if (variant === 'lobby')
    return player.control !== 'human' ? 'Bot ready' : player.isReady ? 'Ready' : 'Not ready';
  if (variant === 'result') return player.handCount === 0 ? 'Out' : `${player.handCount} cards`;
  if (active) return 'Playing';
  return player.handCount === 0 ? 'Out' : `${player.handCount} cards`;
}

export function TeamBoard({
  state,
  sessionId,
  variant,
  spectator = false,
  host = false,
  onJoinTeam,
  onRemoveBot,
}: {
  state: GameState;
  sessionId: string;
  variant: Variant;
  spectator?: boolean;
  host?: boolean;
  onJoinTeam?: (team: number) => void;
  onRemoveBot?: (id: string) => void;
}) {
  const players = Array.from(state.players.values());
  const order = Array.from(state.seatOrder);
  const me = state.players.get(sessionId);
  const perTeam = state.maxPlayers / 2;
  const manual = variant === 'lobby' && state.teamSelection === 'manual' && !spectator;

  return (
    <section className={`team-board team-board--${variant}`} aria-label="Teams">
      {teamNames.map((name, team) => {
        const members = players
          .filter((player) => player.team === team)
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        const isMine = me?.team === team;
        const isWinner =
          variant === 'result' && state.outcome === 'win' && state.winnerTeam === team;
        return (
          <div
            key={name}
            className={`team-side team-side--${name.toLowerCase()} ${isMine ? 'is-mine' : ''} ${isWinner ? 'is-winner' : ''}`}
          >
            <div className="team-side-heading">
              <div>
                <span className="team-emblem" aria-hidden="true">
                  {team === 0 ? '◆' : '●'}
                </span>
                <strong>{name}</strong>
                {isMine && variant !== 'result' && <small>Your team</small>}
              </div>
              <span className="team-side-count">
                {variant === 'lobby'
                  ? `${members.length}/${perTeam}`
                  : isWinner
                    ? 'Winners'
                    : variant === 'result'
                      ? 'Final'
                      : `${members.reduce((sum, player) => sum + player.handCount, 0)} cards`}
              </span>
            </div>
            <ul>
              {members.map((player) => {
                const active = variant === 'playing' && state.currentTurn === player.id;
                return (
                  <li key={player.id} className={active ? 'team-player is-active' : 'team-player'}>
                    <span className="team-player-avatar" aria-hidden="true">
                      {(player.username || 'G').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="team-player-name">
                      {player.username || 'Guest'}
                      {player.id === sessionId ? ' (you)' : ''}
                    </span>
                    <span className="team-player-status">
                      {playerStatus(player, variant, active)}
                    </span>
                    {variant === 'lobby' && host && player.control === 'bot' && onRemoveBot && (
                      <button
                        className="team-remove"
                        aria-label={`Remove ${player.username || 'bot'}`}
                        onClick={() => onRemoveBot(player.id)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
              {variant === 'lobby' &&
                Array.from({ length: Math.max(0, perTeam - members.length) }, (_, index) => (
                  <li key={`open-${index}`} className="team-player is-empty">
                    <span className="team-player-avatar" aria-hidden="true">
                      +
                    </span>
                    <span className="team-player-name">Open seat</span>
                  </li>
                ))}
            </ul>
            {manual && (
              <button
                className="team-join"
                disabled={Boolean(
                  isMine || members.length >= perTeam || state.phase === 'countdown',
                )}
                onClick={() => onJoinTeam?.(team)}
              >
                {isMine ? 'Your side' : members.length >= perTeam ? 'Team full' : `Join ${name}`}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
