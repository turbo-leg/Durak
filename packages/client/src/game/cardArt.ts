import type { TableCard } from './tableSnapshot';

const RANK_FILES: Record<number, string> = {
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'jack',
  12: 'queen',
  13: 'king',
  // These are game strengths, not the numerals printed on the cards.
  14: '3',
  15: '2',
  16: 'ace',
};
const SUIT_FILES: Record<string, string> = {
  Clubs: 'clubs',
  Diamonds: 'diamonds',
  Hearts: 'hearts',
  Spades: 'spades',
};

export function cardFaceUrl(
  card: Pick<TableCard, 'rank' | 'suit' | 'isJoker'>,
): string | undefined {
  const base = `${import.meta.env.BASE_URL}cards/classic/`;
  if (card.isJoker && (card.rank === 17 || card.rank === 18))
    return `${base}${card.rank === 18 ? 'red' : 'black'}-joker.webp`;
  const rank = RANK_FILES[card.rank];
  const suit = SUIT_FILES[card.suit];
  return rank && suit ? `${base}${rank}-of-${suit}.webp` : undefined;
}

/** Used for the public Huzur, which is viewed at a shallow angle. */
export function highResolutionCardFaceUrl(card: Pick<TableCard, 'rank' | 'suit' | 'isJoker'>) {
  return cardFaceUrl(card)?.replace('/classic/', '/classic/high-resolution/');
}
