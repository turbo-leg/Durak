import type { GameState, Player } from '@durak/shared';
import { t } from '../i18n';

type Variant = 'lobby' | 'playing' | 'result';

const teamNames = ['Blue', 'Red'] as const;

function playerStatus(player: Player, variant: Variant, active: boolean) {
  if (variant === 'lobby')
    return player.control !== 'human'
      ? t('Bot ready')
      : player.isReady
        ? t('Ready')
        : t('Not ready');
  if (variant === 'result')
    return player.handCount === 0 ? t('Out') : t('{n} cards', { n: player.handCount });
  if (active) return t('Playing');
  return player.handCount === 0 ? t('Out') : t('{n} cards', { n: player.handCount });
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
    <section className={`team-board team-board--${variant}`} aria-label={t('Teams')}>
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
                <strong>{t(name)}</strong>
                {isMine && variant !== 'result' && <small>{t('Your team')}</small>}
              </div>
              <span className="team-side-count">
                {variant === 'lobby'
                  ? `${members.length}/${perTeam}`
                  : isWinner
                    ? t('Winners')
                    : variant === 'result'
                      ? t('Final')
                      : t('{n} cards', {
                          n: members.reduce((sum, player) => sum + player.handCount, 0),
                        })}
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
                      {player.id === sessionId
                        ? t('{name} (you)', { name: player.username || t('Guest') })
                        : player.username || t('Guest')}
                    </span>
                    <span className="team-player-status">
                      {playerStatus(player, variant, active)}
                    </span>
                    {variant === 'lobby' && host && player.control === 'bot' && onRemoveBot && (
                      <button
                        className="team-remove"
                        aria-label={t('Remove {name}', { name: player.username || t('bot') })}
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
                    <span className="team-player-name">{t('Open seat')}</span>
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
                {isMine
                  ? t('Your side')
                  : members.length >= perTeam
                    ? t('Team full')
                    : t('Join {team}', { team: t(name) })}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
