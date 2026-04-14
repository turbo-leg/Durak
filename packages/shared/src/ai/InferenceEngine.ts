import { Card, Suit } from "../state/Card";
import { GameState } from "../state/GameState";

export class InferenceEngine {
  // Player SessionID -> Set of Cards currently known to be in their hand
  public knownHands: Map<string, Set<string>> = new Map();
  
  // Set of cards that are definitely in the discard pile
  public discarded: Set<string> = new Set();

  // Player SessionID -> Set of Suits they are confirmed to be OUT of (including trump)
  public voidSuits: Map<string, Set<string>> = new Map();

  /**
   * Serializes a card to a unique string key.
   */
  public getCardKey(card: Card): string {
    if (card.isJoker) return `Joker_${card.rank}`;
    return `${card.suit}_${card.rank}`;
  }

  /**
   * Updates memory based on a new GameState observation.
   */
  public observe(state: GameState) {
    // 1. Update Discard Pile
    state.discardPile.forEach(c => this.discarded.add(this.getCardKey(c)));

    // 2. Clear known cards that have been discarded
    this.knownHands.forEach((hand, playerId) => {
      hand.forEach(cardKey => {
        if (this.discarded.has(cardKey)) {
          hand.delete(cardKey);
        }
      });
    });

    // 3. Deduction logic would go here: 
    // e.g. If a player was defender and current table has a Spade, 
    // but they picked up instead of defending -> they are possibly VOID in Spades AND Huzur.
  }

  /**
   * Specifically records when a player "Picks up" a set of cards.
   */
  public recordPickup(playerId: string, cards: Card[]) {
    if (!this.knownHands.has(playerId)) {
      this.knownHands.set(playerId, new Set());
    }
    const hand = this.knownHands.get(playerId)!;
    cards.forEach(c => hand.add(this.getCardKey(c)));
  }

  /**
   * Records when a player fails to defend a specific suit.
   */
  public recordVoid(playerId: string, suit: string) {
    if (!this.voidSuits.has(playerId)) {
      this.voidSuits.set(playerId, new Set());
    }
    this.voidSuits.get(playerId)!.add(suit);
  }

  /**
   * Estimates the probability of a player having a specific card.
   */
  public getDeduction(playerId: string, card: Card): "known" | "possible" | "impossible" {
    const key = this.getCardKey(card);
    if (this.discarded.has(key)) return "impossible";
    
    // If we know they have it
    if (this.knownHands.get(playerId)?.has(key)) return "known";

    // If we know they are void in that suit (and it's not a Joker)
    if (!card.isJoker && this.voidSuits.get(playerId)?.has(card.suit)) return "impossible";

    return "possible";
  }
}
