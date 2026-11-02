import type { Card } from '@durak/shared';

/** How a player lays out their own hand. The first card is the leftmost in the fan. */
export type HandOrder = 'suit' | 'rank' | 'dealt';

export const HAND_ORDERS: readonly HandOrder[] = ['suit', 'rank', 'dealt'];

export const HAND_ORDER_LABEL: Record<HandOrder, string> = {
  suit: 'By suit',
  rank: 'High to low',
  dealt: 'As dealt',
};

const STORAGE_KEY = 'durak_hand_order';

export function savedHandOrder(): HandOrder {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return HAND_ORDERS.includes(saved as HandOrder) ? (saved as HandOrder) : 'suit';
  } catch {
    return 'suit';
  }
}

export function saveHandOrder(order: HandOrder) {
  try {
    localStorage.setItem(STORAGE_KEY, order);
  } catch {
    // Private windows can refuse storage; the order still applies for this visit.
  }
}

type CardFace = Pick<Card, 'suit' | 'rank' | 'isJoker'>;

/** Red and black alternate so neighbouring suit groups are easy to tell apart. */
const SUIT_ORDER = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];

/** Jokers first, then the huzur suit, then the other suits; ranks fall within each group. */
function group(card: CardFace, huzurSuit: string) {
  if (card.isJoker) return 0;
  if (card.suit === huzurSuit) return 1;
  const suit = SUIT_ORDER.indexOf(card.suit);
  return 2 + (suit < 0 ? SUIT_ORDER.length : suit);
}

/** Strength as the rules rank it: jokers, then huzur cards, then everything else by rank. */
function strength(card: CardFace, huzurSuit: string) {
  if (card.isJoker) return 200 + card.rank;
  if (card.suit === huzurSuit) return 100 + card.rank;
  return card.rank;
}

/**
 * Orders a hand for display, strongest on the left. 'suit' groups each suit together,
 * 'rank' runs from the strongest card to the weakest, and 'dealt' keeps the server's order.
 */
export function sortHand<T extends CardFace>(
  hand: readonly T[],
  order: HandOrder,
  huzurSuit: string,
): T[] {
  if (order === 'dealt') return [...hand];
  return [...hand].sort((a, b) =>
    order === 'suit'
      ? group(a, huzurSuit) - group(b, huzurSuit) || b.rank - a.rank
      : strength(b, huzurSuit) - strength(a, huzurSuit) ||
        group(a, huzurSuit) - group(b, huzurSuit),
  );
}
