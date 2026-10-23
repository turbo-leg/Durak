import type { TableSnapshot } from './tableSnapshot';

/** The local player, wherever an event names a seat. */
export const SELF = 'self';

/**
 * Public moments characters act out, derived from two consecutive table snapshots.
 * Only public state is read: counts, played sequences and cards on the table.
 */
export type TableEvent =
  | { kind: 'play'; seat: string; cards: string[] }
  | { kind: 'pickup'; seat: string; cards: string[] }
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
  const cleared = [...before].filter((key) => !now.has(key));
  const pickedUp = cleared.length > 0 && next.discardCount === previous.discardCount;
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
              ? {
                  played: previous.self.played,
                  count: previous.hand.length,
                  active: previous.canSelect,
                }
              : undefined,
          },
        ]
      : []),
  ];
  // One patch can hold a play and the refill after it, or a pickup and everyone's refill:
  // what each person gained is their new count plus the cards they just put down.
  const gains = new Map<string, number>();
  for (const person of people) {
    if (!person.was) continue;
    const played = person.played > (person.was.played ?? 0) && fresh.length > 0;
    if (played) events.push({ kind: 'play', seat: person.id, cards: fresh });
    gains.set(person.id, person.count - person.was.count + (played ? fresh.length : 0));
  }
  // The pile goes to one person, the defender if they took at least that many.
  const taker = pickedUp
    ? people
        .filter((person) => (gains.get(person.id) ?? 0) >= cleared.length)
        .sort((a, b) => Number(Boolean(b.was?.active)) - Number(Boolean(a.was?.active)))[0]
    : undefined;
  for (const person of people) {
    let gained = gains.get(person.id) ?? 0;
    if (person === taker) {
      events.push({ kind: 'pickup', seat: person.id, cards: cleared });
      gained -= cleared.length;
    }
    if (gained > 0 && drawn) events.push({ kind: 'draw', seat: person.id, count: gained });
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
