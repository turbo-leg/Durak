import { type, Schema } from '@colyseus/schema';

export enum Suit {
  Spades = 'Spades',
  Hearts = 'Hearts',
  Diamonds = 'Diamonds',
  Clubs = 'Clubs',
  None = 'None',
}

export enum Rank {
  Seven = 7, // Standard lowest
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Three = 14, // High Value
  Two = 15, // Higher Value
  Ace = 16, // Highest Elite
  BlackJoker = 17,
  RedJoker = 18, // Largest
}

export class Card extends Schema {
  @type('string') suit: string;
  @type('number') rank: number;
  @type('boolean') isJoker: boolean;

  constructor(suit: string = Suit.None, rank: number = Rank.Seven, isJoker: boolean = false) {
    super();
    this.suit = suit;
    this.rank = rank;
    this.isJoker = isJoker;
  }
}
