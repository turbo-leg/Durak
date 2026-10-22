import type { TableSnapshot } from './tableSnapshot';

/** The local player, wherever an event names a seat. */
export const SELF = 'self';

/**
 * Public moments characters act out, derived from two consecutive table snapshots.
 * Only public state is read: counts, played sequences and cards on the table.
 */
export type TableEvent =
  | { kind: 'play'; seat: string; cards: string[] }
  | { kind: 'pickup'; seat: string }
  | { kind: 'draw'; seat: string; count: number }
  | { kind: 'gameOver'; winners: string[]; loser?: string };

const onTable = (s: TableSnapshot) => new Set([...s.attacks, ...s.history].map((c) => c.key));

export function tableEvents(
  previous: TableSnapshot | undefined,
  next: TableSnapshot,
): TableEvent[] {
  if (!previous) return [];
  const events: TableEvent[] = [];
  const before = onTable(previous);
  const now = onTable(next);
  const fresh = [...now].filter((key) => !before.has(key));
  const cleared = [...before].some((key) => !now.has(key));
  const pickedUp = cleared && next.discardCount === previous.discardCount;
  const drawn = next.deckCount < previous.deckCount;

  const people = [
    ...next.seats.map((seat) => ({
      id: seat.id,
      played: seat.played ?? 0,
      count: seat.count,
      escaped: seat.escaped,
      was: previous.seats.find((s) => s.id === seat.id),
    })),
    ...(next.self && !next.spectator
      ? [
          {
            id: SELF,
            played: next.self.played,
            count: next.hand.length,
            escaped: Boolean(next.self.escaped),
            was: previous.self
              ? { played: previous.self.played, count: previous.hand.length }
              : undefined,
          },
        ]
      : []),
  ];
  for (const person of people) {
    if (!person.was) continue;
    if (person.played > (person.was.played ?? 0) && fresh.length)
      events.push({ kind: 'play', seat: person.id, cards: fresh });
    const gained = person.count - person.was.count;
    if (gained <= 0) continue;
    if (pickedUp) events.push({ kind: 'pickup', seat: person.id });
    else if (drawn) events.push({ kind: 'draw', seat: person.id, count: gained });
  }
  if (!previous.betweenGames && next.betweenGames) {
    const winners = people.filter((p) => p.escaped).map((p) => p.id);
    const holding = people.filter((p) => !p.escaped && p.count > 0);
    // The durak is the one player left holding cards.
    events.push({
      kind: 'gameOver',
      winners,
      ...(holding.length === 1 ? { loser: holding[0]!.id } : {}),
    });
  }
  return events;
}
