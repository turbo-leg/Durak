import { Card, Suit, Rank } from "../state/Card";
import { Player } from "../state/Player";
import { GameState } from "../state/GameState";

export class DurakEngine {
  /**
   * Initializes a new Durak game given a GameState, player IDs, and hand size.
   */
  static initializeGame(state: GameState, playerIds: string[], handSize: number, mode: string = "classic"): void {
    state.mode = mode;
    state.phase = "playing";
    state.seatOrder.splice(0, state.seatOrder.length);
    state.players.clear();
    state.deck.splice(0, state.deck.length);

    for (const [index, id] of playerIds.entries()) {
      const p = new Player(id);
      // assign teams if needed
      if (mode === "teams") {
        p.team = index % 2; // Simple alternating teams
      }
      state.players.set(id, p);
      state.seatOrder.push(id);
    }

    let deck = DurakEngine.createDeck();
    deck = DurakEngine.shuffleDeck(deck);

    // Set Huzur
    const huzurCard = deck[deck.length - 1]!;
    state.huzurCard.suit = huzurCard.suit;
    state.huzurCard.rank = huzurCard.rank;
    state.huzurCard.isJoker = huzurCard.isJoker;
    state.huzurSuit = huzurCard.suit;

    state.deck.push(...deck);

    // Deal cards
    for (let i = 0; i < handSize; i++) {
      for (const id of state.seatOrder) {
        if (state.deck.length > 0) {
          const p = state.players.get(id);
          p?.hand.push(state.deck.shift()!);
        }
      }
    }

    // Determine first turn ideally (for simplicity in tests just set to player 0)
    state.currentTurn = state.seatOrder[0]!;
  }

  /**
   * Generates the custom 42-card deck: 10 ranks per suit + 2 jokers.
   * Excluding 4, 5, 6.
   */
  static createDeck(): Card[] {
    const deck: Card[] = [];
    const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
    const ranks = [
      Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
      Rank.Jack, Rank.Queen, Rank.King,
      Rank.Three, Rank.Two, Rank.Ace
    ];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(new Card(suit, rank, false));
      }
    }

    // Add Jokers
    deck.push(new Card(Suit.None, Rank.BlackJoker, true));
    deck.push(new Card(Suit.None, Rank.RedJoker, true));

    return deck;
  }

  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * Returns > 0 if cardA beats cardB outright based on standard power rules + Huzur + Jokers.
   */
  static compareStrength(cardA: Card, cardB: Card, huzurSuit: string): number {
    // Both Jokers
    if (cardA.isJoker && cardB.isJoker) {
      return cardA.rank - cardB.rank; // Red (18) beats Black (17)
    }
    // One Joker (beats everything non-joker)
    if (cardA.isJoker) return 1;
    if (cardB.isJoker) return -1;

    const aIsHuzur = cardA.suit === huzurSuit;
    const bIsHuzur = cardB.suit === huzurSuit;

    // Huzur superiority
    if (aIsHuzur && !bIsHuzur) return 1;
    if (!aIsHuzur && bIsHuzur) return -1;

    // Normal comparison requires matching suits (unless one was Huzur)
    if (cardA.suit !== cardB.suit) {
      return 0; 
    }

    return cardA.rank - cardB.rank;
  }

  /**
   * Checks if defendingCard can successfully beat attackingCard under rules.
   */
  static canDefend(defendingCard: Card, attackingCard: Card, huzurSuit: string): boolean {
    if (defendingCard.isJoker) {
      return DurakEngine.compareStrength(defendingCard, attackingCard, huzurSuit) > 0;
    }

    // Must match suit unless attacking with a non-trump and defending with trump
    if (defendingCard.suit === attackingCard.suit || defendingCard.suit === huzurSuit) {
      return DurakEngine.compareStrength(defendingCard, attackingCard, huzurSuit) > 0;
    }
    
    return false;
  }

  /**
   * Mass = 3 or 5 cards based on conditions.
   * 3-Card Mass: 1 pair + 1 random card. (Denied if anyone has < 3 cards)
   * 5-Card Mass: 2 pairs + 1 random card. (Only if deck empty AND everyone has >= 5 cards)
   */
  static isValidMassAttack(cards: Card[], allPlayers: Player[], deckSize: number, targetHandSize: number = 5): boolean {
    if (cards.length === 3) {
      for (const p of allPlayers) {
        if (p.hand.length < 3) return false;
      }
      
      const ranks = new Map<number, number>();
      for (const c of cards) {
        if (c.isJoker) continue;
        ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1);
      }

      let pairs = 0;
      ranks.forEach((count) => {
        pairs += Math.floor(count / 2);
      });
      return pairs >= 1;
    } else if (cards.length === 5) {
      if (targetHandSize < 7 && deckSize > 0) return false;
      
      for (const p of allPlayers) {
        if (p.hand.length < 5) return false;
      }
      
      const ranks = new Map<number, number>();
      for (const c of cards) {
        if (c.isJoker) continue;
        ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1);
      }

      let pairs = 0;
      ranks.forEach((count) => {
        pairs += Math.floor(count / 2);
      });
      return pairs >= 2;
    }
    
    return false;
  }

  /**
   * Verifies if a set of defenders can beat a set of attackers in a 1-to-1 match.
   */
  static canDefendMass(defenders: Card[], attackers: Card[], huzurSuit: string): boolean {
    if (defenders.length !== attackers.length) return false;

    const usedDefenders = new Set<number>();
    
    function backtrack(attackerIndex: number): boolean {
      if (attackerIndex === attackers.length) return true;
      
      for (let i = 0; i < defenders.length; i++) {
        if (usedDefenders.has(i)) continue;
        if (DurakEngine.canDefend(defenders[i], attackers[attackerIndex], huzurSuit)) {
          usedDefenders.add(i);
          if (backtrack(attackerIndex + 1)) return true;
          usedDefenders.delete(i);
        }
      }
      return false;
    }

    return backtrack(0);
  }

  /**
   * Evaluates how many cards a player should draw.
   * "If someone picks up... wait until they have less than 5 cards to draw."
   */
  static computeDrawAmount(player: Player, deckSize: number): number {
    if (deckSize <= 0) return 0;

    if (player.hasPickedUp) {
      if (player.hand.length >= 5) return 0;
      // Below 5, draw to 5
      return Math.min(deckSize, 5 - player.hand.length);
    }

    // Standard draw to 5
    const needed = 5 - player.hand.length;
    return needed > 0 ? Math.min(deckSize, needed) : 0;
  }

  static swapHuzur(player: Player, state: GameState): boolean {
    if (state.deck.length === 0) return false;
    
    const handIndex = player.hand.findIndex(c => c.suit === state.huzurSuit && c.rank === Rank.Seven);
    if (handIndex === -1) return false;

    const playerSeven = player.hand[handIndex]!;
    
    // The visual table card
    const tableHuzur = state.huzurCard;
    // The actual deck bottom card
    const actualDeckHuzur = state.deck[0]!;

    // Move the player's 7 attributes
    const tempSuit = playerSeven.suit;
    const tempRank = playerSeven.rank;
    const tempIsJoker = playerSeven.isJoker;

    // Give player the tableHuzur's power
    playerSeven.suit = tableHuzur.suit;
    playerSeven.rank = tableHuzur.rank;
    playerSeven.isJoker = tableHuzur.isJoker;

    // Set the tableHuzur and deck bottom card to the 7
    tableHuzur.suit = tempSuit;
    tableHuzur.rank = tempRank;
    tableHuzur.isJoker = tempIsJoker;

    if (actualDeckHuzur) {
      actualDeckHuzur.suit = tempSuit;
      actualDeckHuzur.rank = tempRank;
      actualDeckHuzur.isJoker = tempIsJoker;
    }

    return true;
  }

  /**
   * Resets the round state. Clears table if successful, or hands cards to player if they pick up.
   */
  static endRound(state: GameState, pickerUpperId: string | null): void {
    if (pickerUpperId) {
      // Player picked up the whole table
      const player = state.players.get(pickerUpperId);
      if (player) {
        state.table.forEach(card => player.hand.push(new Card(card.suit, card.rank, card.isJoker)));
        state.activeAttackCards.forEach(card => player.hand.push(new Card(card.suit, card.rank, card.isJoker)));
        player.hasPickedUp = true;
      }
    } else {
      // Success! Cards are dead.
      state.table.forEach(card => state.discardPile.push(new Card(card.suit, card.rank, card.isJoker)));
      state.activeAttackCards.forEach(card => state.discardPile.push(new Card(card.suit, card.rank, card.isJoker)));
    }

    // Reset cycle
    state.table.splice(0, state.table.length);
    state.activeAttackCards.splice(0, state.activeAttackCards.length);
    state.defenseChainCount = 0;
  }

  /**
   * Helper to draw cards for all players at the end of a round.
   */
  static replenishAll(state: GameState): void {
    state.players.forEach(player => {
      const amount = DurakEngine.computeDrawAmount(player, state.deck.length);
      for (let i = 0; i < amount; i++) {
        const card = state.deck.pop();
        if (card) player.hand.push(new Card(card.suit, card.rank, card.isJoker));
      }
    });
  }
}
