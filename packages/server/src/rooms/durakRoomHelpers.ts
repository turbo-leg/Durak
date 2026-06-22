import { Card, Player } from '@durak/shared';

// Pure helpers extracted from DurakRoom — no room/`this` state, so they live here
// to keep the room class focused on lifecycle and game flow.

/** Compact human-readable notation for a card, e.g. "Ah", "10c", "BJ"/"RJ" for jokers. */
export function formatCard(c: Card): string {
  if (c.isJoker) return c.rank === 15 ? 'BJ' : 'RJ';
  const suits: Record<string, string> = { Clubs: 'c', Diamonds: 'd', Hearts: 'h', Spades: 's' };
  let r = c.rank.toString();
  if (c.rank === 11) r = 'J';
  else if (c.rank === 12) r = 'Q';
  else if (c.rank === 13) r = 'K';
  else if (c.rank === 14) r = 'A';
  return `${r}${suits[c.suit] || c.suit.charAt(0).toLowerCase()}`;
}

/** Validate and parse a raw client card payload. Returns null if malformed. */
export function parseCards(raw: unknown): Card[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cards: Card[] = [];
  for (const c of raw) {
    if (
      typeof c?.suit !== 'string' ||
      typeof c?.rank !== 'number' ||
      typeof c?.isJoker !== 'boolean'
    )
      return null;
    cards.push(new Card(c.suit, c.rank, c.isJoker));
  }
  return cards;
}

/** True iff every card in `cards` is present in the player's hand (deduplication-aware). */
export function playerOwnsCards(player: Player, cards: Card[]): boolean {
  const counts = new Map<string, number>();
  for (const c of player.hand) {
    if (!c) continue;
    const key = `${c.suit}:${c.rank}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const c of cards) {
    const key = `${c.suit}:${c.rank}`;
    const count = counts.get(key) || 0;
    if (count <= 0) return false;
    counts.set(key, count - 1);
  }
  return true;
}

/** Returns true if card `a` outranks card `b` for the suhuh draw, given the trump suit. */
export function cardBeats(a: Card, b: Card, huzurSuit: string): boolean {
  if (a.isJoker && !b.isJoker) return true;
  if (!a.isJoker && b.isJoker) return false;
  if (a.isJoker && b.isJoker) return a.rank > b.rank;

  const huzur = huzurSuit.toLowerCase();
  const aSuit = a.suit.toLowerCase();
  const bSuit = b.suit.toLowerCase();

  // 1. Trump vs Non-Trump
  if (aSuit === huzur && bSuit !== huzur) return true;
  if (aSuit !== huzur && bSuit === huzur) return false;

  // 2. Rank Comparison (if different ranks)
  if (a.rank !== b.rank) {
    return a.rank > b.rank;
  }

  // 3. Suit Hierarchy Tie-breaker (if equal ranks)
  // Strength: Trump > Spades > Hearts > Clubs > Diamonds
  const getSuitStrength = (suit: string): number => {
    if (suit === huzur) return 4;
    if (suit === 'spades') return 3;
    if (suit === 'hearts') return 2;
    if (suit === 'clubs') return 1;
    if (suit === 'diamonds') return 0;
    return -1;
  };

  return getSuitStrength(aSuit) > getSuitStrength(bSuit);
}
