import { describe, expect, it } from 'vitest';
import { sortHand } from '../game/handOrder';
import { cardLabel } from '../game/tableSnapshot';

const card = (suit: string, rank: number, isJoker = false) => ({ suit, rank, isJoker });
const hand = [
  card('Clubs', 9),
  card('Hearts', 16),
  card('Spades', 7),
  card('Diamonds', 13),
  card('None', 17, true),
  card('Hearts', 8),
  card('Clubs', 15),
  card('Diamonds', 11),
];
const labels = (cards: ReturnType<typeof card>[]) => cards.map(cardLabel);

describe('sortHand', () => {
  it('groups by suit with jokers and the huzur suit on the left', () => {
    expect(labels(sortHand(hand, 'suit', 'Diamonds'))).toEqual([
      'Black Joker',
      'King of Diamonds',
      'Jack of Diamonds',
      '7 of Spades',
      'Ace of Hearts',
      '8 of Hearts',
      '2 of Clubs',
      '9 of Clubs',
    ]);
  });

  it('runs from strongest to weakest, huzur cards above every plain card', () => {
    expect(labels(sortHand(hand, 'rank', 'Diamonds'))).toEqual([
      'Black Joker',
      'King of Diamonds',
      'Jack of Diamonds',
      'Ace of Hearts',
      '2 of Clubs',
      '9 of Clubs',
      '8 of Hearts',
      '7 of Spades',
    ]);
  });

  it('keeps the dealt order and never changes the hand it was given', () => {
    const before = labels(hand);
    expect(labels(sortHand(hand, 'dealt', 'Diamonds'))).toEqual(before);
    sortHand(hand, 'rank', 'Diamonds');
    expect(labels(hand)).toEqual(before);
  });
});
