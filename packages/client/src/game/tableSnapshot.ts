import type { Card, GameState, PublicGesture } from '@durak/shared';

export interface TableCard {
  readonly key: string;
  readonly suit: string;
  readonly rank: number;
  readonly isJoker: boolean;
}

export interface TableSeat extends PublicGesture {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly active: boolean;
  readonly escaped: boolean;
  readonly preset?: string;
  readonly yaw?: number;
  readonly pitch?: number;
  readonly team?: number;
  readonly played?: number;
  readonly bot?: boolean;
  readonly ready?: boolean;
  readonly connected?: boolean;
  /** A temporary bot is playing this person's seat. */
  readonly standin?: boolean;
}

export interface TableSnapshot {
  readonly signature: string;
  readonly hand: readonly TableCard[];
  readonly attacks: readonly TableCard[];
  readonly history: readonly TableCard[];
  readonly seats: readonly TableSeat[];
  readonly huzur: TableCard;
  readonly deckCount: number;
  readonly discardCount: number;
  readonly canSelect: boolean;
  readonly self?: { preset: string; played: number; escaped?: boolean } & PublicGesture;
  readonly serverTimeOffset?: number;
  readonly spectator?: boolean;
  readonly teamMode?: boolean;
  /** A confirmed result, including its short rematch countdown. */
  readonly resultVisible?: boolean;
  readonly resultDraw?: boolean;
  readonly winnerTeam?: number;
  /** Selected seat count, so empty seats can be shown around the table. */
  readonly capacity?: number;
  /** Waiting, counting down or showing results: seats show readiness. */
  readonly betweenGames?: boolean;
}

/** Public seat status: readiness between games, card count during play. */
export function seatStatus(
  seat: TableSeat,
  betweenGames?: boolean,
  resultVisible?: boolean,
): string {
  if (resultVisible) return seat.escaped ? 'Won' : `${seat.count} cards`;
  if (seat.standin) return 'Bot playing';
  if (seat.connected === false) return 'Reconnecting';
  if (betweenGames) return seat.bot ? 'Bot' : seat.ready ? 'Ready' : 'Not ready';
  return seat.escaped ? 'Won' : `${seat.count} cards`;
}

export const cardIdentity = (card: Pick<Card, 'suit' | 'rank' | 'isJoker'>) =>
  `${card.suit}:${card.rank}:${card.isJoker ? 1 : 0}`;

export function cardLabel(card: Pick<Card, 'suit' | 'rank' | 'isJoker'>): string {
  if (card.isJoker) return card.rank === 18 ? 'Red Joker' : 'Black Joker';
  const rank: Record<number, string> = {
    11: 'Jack',
    12: 'Queen',
    13: 'King',
    14: '3',
    15: '2',
    16: 'Ace',
  };
  return `${rank[card.rank] ?? card.rank} of ${card.suit}`;
}

const copyCard = (card: Card): TableCard => ({
  key: cardIdentity(card),
  suit: card.suit,
  rank: card.rank,
  isJoker: card.isJoker,
});
const copyCards = (cards: Iterable<Card | undefined> | undefined) =>
  Array.from(cards ?? [])
    .filter((c): c is Card => !!c)
    .map(copyCard);

/** Resolved attack cards on the table: the ranks a single-card attack may add. */
export const tableCards = (state: GameState): TableCard[] => copyCards(state.table);

// Colyseus mutates schema objects in place. Copy public presentation values so
// the renderer never owns schema references, rules, credentials or opponents' hands.
export function tableSnapshot(
  state: GameState,
  sessionId: string,
  spectator: boolean,
  serverTimeOffset = 0,
): TableSnapshot {
  const order = Array.from(state.seatOrder).filter((id): id is string => !!id);
  const ids = order.length ? order : Array.from(state.players.keys());
  const index = ids.indexOf(sessionId);
  const relative = spectator || index < 0 ? ids : [...ids.slice(index + 1), ...ids.slice(0, index)];
  const seats = relative
    .filter((id) => spectator || id !== sessionId)
    .flatMap((id) => {
      const p = state.players.get(id);
      return p
        ? [
            {
              id,
              name: p.username || id.slice(0, 6),
              count: p.handCount,
              active: state.phase === 'playing' && state.currentTurn === id,
              escaped: state.winners.includes(id),
              preset: p.avatarPreset,
              yaw: p.headYaw,
              pitch: p.headPitch,
              team: p.team,
              played: p.playSequence,
              gestureId: p.gestureId,
              gestureStartedAt: p.gestureStartedAt,
              gestureSequence: p.gestureSequence,
              // Explicit control status; temporary stand-ins also behave as bots.
              bot: p.control !== 'human',
              ready: p.isReady,
              connected: p.connected,
              standin: p.control === 'standin',
            },
          ]
        : [];
    });
  const snapshot = {
    self: {
      preset: state.players.get(sessionId)?.avatarPreset || 'copper',
      played: state.players.get(sessionId)?.playSequence || 0,
      escaped: state.winners.includes(sessionId),
      gestureId: state.players.get(sessionId)?.gestureId,
      gestureStartedAt: state.players.get(sessionId)?.gestureStartedAt,
      gestureSequence: state.players.get(sessionId)?.gestureSequence,
    },
    spectator,
    serverTimeOffset,
    teamMode: state.mode !== 'classic',
    resultVisible:
      state.phase === 'finished' || (state.phase === 'countdown' && state.winners.length > 0),
    resultDraw: state.outcome === 'draw',
    winnerTeam: state.winnerTeam,
    capacity: state.maxPlayers,
    betweenGames: ['waiting', 'countdown', 'finished'].includes(state.phase),
    hand: spectator ? [] : copyCards(state.players.get(sessionId)?.hand),
    attacks: copyCards(state.activeAttackCards),
    history: copyCards(state.tableStacks),
    seats,
    huzur: copyCard(state.huzurCard),
    deckCount: state.deckCount,
    discardCount: state.discardPile.length,
    canSelect: !spectator && state.phase === 'playing' && state.currentTurn === sessionId,
  };
  return { ...snapshot, signature: JSON.stringify(snapshot) };
}
