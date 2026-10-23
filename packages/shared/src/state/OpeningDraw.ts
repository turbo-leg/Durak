import { type, Schema } from '@colyseus/schema';
import { Card } from './Card';

/** One public Suhuh reveal. The card returns to the deck after the comparison. */
export class OpeningDraw extends Schema {
  @type('string') playerId: string = '';
  @type(Card) card: Card = new Card();

  constructor(playerId: string = '', card: Card = new Card()) {
    super();
    this.playerId = playerId;
    this.card = card;
  }
}
