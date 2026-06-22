// Maps a suit + rank to the bundled Vector Playing Cards SVG deck in /assets/cards.

export const CARD_ASPECT = 167.0869141 / 242.6669922; // w / h ≈ 0.6886

const SUIT_TO_WORD: Record<string, string> = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
  spades: 'spades',
  hearts: 'hearts',
  diamonds: 'diamonds',
  clubs: 'clubs',
  Spades: 'spades',
  Hearts: 'hearts',
  Diamonds: 'diamonds',
  Clubs: 'clubs',
};

const RANK_TO_WORD: Record<string, string> = {
  A: 'ace',
  ace: 'ace',
  Ace: 'ace',
  K: 'king',
  king: 'king',
  King: 'king',
  Q: 'queen',
  queen: 'queen',
  Queen: 'queen',
  J: 'jack',
  jack: 'jack',
  Jack: 'jack',
  T: '10',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

// Durak numeric ranks (see Card.tsx rankNames): 16=A, 15=2, 14=3, 13=K, 12=Q, 11=J, 7-10 literal.
const NUM_RANK_TO_WORD: Record<number, string> = {
  16: 'ace',
  15: '2',
  14: '3',
  13: 'king',
  12: 'queen',
  11: 'jack',
  10: '10',
  9: '9',
  8: '8',
  7: '7',
};

export function suitWord(suit: string): string | undefined {
  return SUIT_TO_WORD[suit];
}

/** Resolve a suit + rank to the bundled SVG path, or null if unmapped (e.g. jokers). */
export function cardImageSrc(suit: string, rank: string | number): string | null {
  const sw = SUIT_TO_WORD[suit];
  const rankWord =
    typeof rank === 'number'
      ? NUM_RANK_TO_WORD[rank]
      : (RANK_TO_WORD[rank] ?? RANK_TO_WORD[String(rank)]);
  if (!sw || !rankWord) return null;
  return `/assets/cards/${rankWord}_of_${sw}.svg`;
}
