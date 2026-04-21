import { expect, test, describe } from 'vitest';
import { DurakEngine } from '../src/engine/DurakEngine';
import { Card, Suit, Rank } from '../src/state/Card';
import { Player } from '../src/state/Player';

describe('DurakEngine - Custom Rules', () => {

  describe('Deck Generation & Shuffling', () => {
    test('createDeck - verifies 42 cards (7 to Ace + 2 Jokers, excluding 4,5,6)', () => {
      const deck = DurakEngine.createDeck();
      expect(deck).toHaveLength(42);
      
      const spades = deck.filter(c => c.suit === Suit.Spades);
      expect(spades).toHaveLength(10);
      
      const hasSeven = spades.some(c => c.rank === Rank.Seven);
      const hasAce = spades.some(c => c.rank === Rank.Ace);
      const hasThree = spades.some(c => c.rank === Rank.Three);
      
      expect(hasSeven).toBe(true);
      expect(hasAce).toBe(true);
      expect(hasThree).toBe(true);
      
      expect(deck.some(c => c.isJoker && c.rank === Rank.BlackJoker)).toBe(true);
      expect(deck.some(c => c.isJoker && c.rank === Rank.RedJoker)).toBe(true);
    });

    test('shuffleDeck - randomizes the deck', () => {
      const deck = DurakEngine.createDeck();
      const shuffled = DurakEngine.shuffleDeck([...deck]);
      expect(shuffled).toHaveLength(42);
      expect(shuffled).not.toEqual(deck);
    });
  });

  describe('Rank Hierarchy & Strength', () => {
    test('Rank Hierarchy - Custom ranking (K < 3 < 2 < Ace < Black Joker < Red Joker)', () => {
      const rK = new Card(Suit.Hearts, Rank.King);
      const r3 = new Card(Suit.Hearts, Rank.Three);
      const r2 = new Card(Suit.Hearts, Rank.Two);
      const rA = new Card(Suit.Hearts, Rank.Ace);
      const bj = new Card(Suit.None, Rank.BlackJoker, true);
      const rj = new Card(Suit.None, Rank.RedJoker, true);

      expect(DurakEngine.compareStrength(r3, rK, Suit.Spades)).toBeGreaterThan(0);
      expect(DurakEngine.compareStrength(r2, r3, Suit.Spades)).toBeGreaterThan(0);
      expect(DurakEngine.compareStrength(rA, r2, Suit.Spades)).toBeGreaterThan(0);
      expect(DurakEngine.compareStrength(bj, rA, Suit.Spades)).toBeGreaterThan(0);
      expect(DurakEngine.compareStrength(rj, bj, Suit.Spades)).toBeGreaterThan(0);
    });

    test('Huzur superiority - Huzur beats non-Huzur regardless of rank', () => {
      const huzurSeven = new Card(Suit.Diamonds, Rank.Seven);
      const normalAce = new Card(Suit.Spades, Rank.Ace);

      expect(DurakEngine.compareStrength(huzurSeven, normalAce, Suit.Diamonds)).toBeGreaterThan(0);
      expect(DurakEngine.compareStrength(normalAce, huzurSeven, Suit.Diamonds)).toBeLessThan(0);
    });
    
    test('Different non-Huzur suits cannot beat each other (returns 0)', () => {
      const heartsAce = new Card(Suit.Hearts, Rank.Ace);
      const spadesAce = new Card(Suit.Spades, Rank.Ace);
      expect(DurakEngine.compareStrength(heartsAce, spadesAce, Suit.Diamonds)).toBe(0);
    });
  });

  describe('Defense Logic (canDefend)', () => {
    test('Can beat with higher card of the same suit', () => {
      const def = new Card(Suit.Clubs, Rank.Ten);
      const atk = new Card(Suit.Clubs, Rank.Nine);
      expect(DurakEngine.canDefend(def, atk, Suit.Spades)).toBe(true);
    });

    test('Cannot beat with lower card of the same suit', () => {
      const def = new Card(Suit.Clubs, Rank.Eight);
      const atk = new Card(Suit.Clubs, Rank.Nine);
      expect(DurakEngine.canDefend(def, atk, Suit.Spades)).toBe(false);
    });

    test('Can beat any non-Huzur with a Huzur card', () => {
      const def = new Card(Suit.Diamonds, Rank.Seven); // lowest Huzur
      const atk = new Card(Suit.Clubs, Rank.Ace); // highest non-Huzur
      expect(DurakEngine.canDefend(def, atk, Suit.Diamonds)).toBe(true);
    });

    test('Cannot beat Huzur with non-Huzur', () => {
      const def = new Card(Suit.Clubs, Rank.Ace);
      const atk = new Card(Suit.Diamonds, Rank.Seven);
      expect(DurakEngine.canDefend(def, atk, Suit.Diamonds)).toBe(false);
    });

    test('Joker can beat anything non-joker', () => {
      const def = new Card(Suit.None, Rank.BlackJoker, true);
      const atk = new Card(Suit.Diamonds, Rank.Ace); // highest Huzur
      expect(DurakEngine.canDefend(def, atk, Suit.Diamonds)).toBe(true);
    });
  });

  describe('Mass Attacks', () => {
    test('3-Card Mass: Valid when it has 1 pair + 1 random card and all players have >= 3 cards', () => {
       const atkCards = [
         new Card(Suit.Hearts, Rank.Jack),
         new Card(Suit.Spades, Rank.Jack),
         new Card(Suit.Clubs, Rank.Seven)
       ];
       
       const p1 = new Player("p1"); p1.hand.push(...[new Card(), new Card(), new Card()]);
       const p2 = new Player("p2"); p2.hand.push(...[new Card(), new Card(), new Card(), new Card()]);
       
       expect(DurakEngine.isValidMassAttack(atkCards, [p1, p2], 10)).toBe(true);
    });

    test('3-Card Mass: Invalid if it lacks a pair', () => {
       const atkCards = [
         new Card(Suit.Hearts, Rank.Jack),
         new Card(Suit.Spades, Rank.Queen),
         new Card(Suit.Clubs, Rank.Seven)
       ];
       const p1 = new Player("p1"); p1.hand.push(...[new Card(), new Card(), new Card()]);
       expect(DurakEngine.isValidMassAttack(atkCards, [p1], 10)).toBe(false);
    });

    test('isValidMassAttack - Joker cannot be the required pair', () => {
      const jokersAndSingle = [
        new Card(Suit.None, Rank.BlackJoker, true),
        new Card(Suit.None, Rank.RedJoker, true),
        new Card(Suit.Hearts, Rank.Seven)
      ];
      const p1 = new Player("p1"); p1.hand.push(...[new Card(), new Card(), new Card()]);
      expect(DurakEngine.isValidMassAttack(jokersAndSingle, [p1], 10)).toBe(false);

      const pairWithJoker = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.None, Rank.RedJoker, true)
      ];
      expect(DurakEngine.isValidMassAttack(pairWithJoker, [p1], 10)).toBe(true);
    });

    test('3-Card Mass: Invalid if any player has < 3 cards', () => {
       const atkCards = [
         new Card(Suit.Hearts, Rank.Jack),
         new Card(Suit.Spades, Rank.Jack),
         new Card(Suit.Clubs, Rank.Seven)
       ];
       
       const p1 = new Player("p1"); p1.hand.push(...[new Card(), new Card()]); // Only 2 cards
       const p2 = new Player("p2"); p2.hand.push(...[new Card(), new Card(), new Card()]);
       
       expect(DurakEngine.isValidMassAttack(atkCards, [p1, p2], 10)).toBe(false);
    });

    test('5-Card Mass: Valid with 2 pairs + 1 random, empty deck, everyone >= 5 cards', () => {
      const atkCards = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.Diamonds, Rank.Nine),
        new Card(Suit.Clubs, Rank.Nine),
        new Card(Suit.Hearts, Rank.Queen)
      ];
      
      const p1 = new Player("p1"); p1.hand.push(...new Array(5).fill(new Card()));
      expect(DurakEngine.isValidMassAttack(atkCards, [p1], 0)).toBe(true);
    });

    test('5-Card Mass: Invalid if deck is not empty', () => {
      const atkCards = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.Diamonds, Rank.Nine),
        new Card(Suit.Clubs, Rank.Nine),
        new Card(Suit.Hearts, Rank.Queen)
      ];
      const p1 = new Player("p1"); p1.hand.push(...new Array(5).fill(new Card()));
      expect(DurakEngine.isValidMassAttack(atkCards, [p1], 1)).toBe(false); // deckSize = 1
    });

    test('5-Card Mass: Invalid if someone has < 5 cards', () => {
      const atkCards = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.Diamonds, Rank.Nine),
        new Card(Suit.Clubs, Rank.Nine),
        new Card(Suit.Hearts, Rank.Queen)
      ];
      const p1 = new Player("p1"); p1.hand.push(...new Array(4).fill(new Card())); // 4 cards
      expect(DurakEngine.isValidMassAttack(atkCards, [p1], 0)).toBe(false); 
    });

    test('canDefendMass - matches defenders to attackers 1-to-1 using backtracking', () => {
      const attackers = [
        new Card(Suit.Hearts, Rank.Seven),
        new Card(Suit.Hearts, Rank.Eight),
        new Card(Suit.Spades, Rank.Ten)
      ];
      const defenders = [
        new Card(Suit.Hearts, Rank.Nine),
        new Card(Suit.Hearts, Rank.Ten),
        new Card(Suit.Diamonds, Rank.Seven) // Diamonds is Huzur
      ];

      expect(DurakEngine.canDefendMass(defenders, attackers, Suit.Diamonds)).toBe(true);
      
      const badDefenders = [
        new Card(Suit.Hearts, Rank.Seven), // cannot beat Seven
        new Card(Suit.Hearts, Rank.Ten),
        new Card(Suit.Diamonds, Rank.Seven)
      ];
      expect(DurakEngine.canDefendMass(badDefenders, attackers, Suit.Diamonds)).toBe(false);
    });
  });

  describe('Huzur Mechanics', () => {
    test('swapHuzur - Allowed if player has 7 of Huzur suit and deck is not empty', () => {
      const p1 = new Player("p1");
      const sevenOfHearts = new Card(Suit.Hearts, Rank.Seven);
      p1.hand.push(...[sevenOfHearts, new Card(Suit.Spades, Rank.Ten)]);

      const faceUpHuzur = new Card(Suit.Hearts, Rank.Ace);
      const fakeState = { huzurSuit: Suit.Hearts, huzurCard: faceUpHuzur, deck: { length: 10 } } as any;
      
      const success = DurakEngine.swapHuzur(p1, fakeState);
      expect(success).toBe(true);
      expect(fakeState.huzurCard.rank).toBe(Rank.Seven);
      expect(p1.hand[0]?.rank).toBe(Rank.Ace);
    });

    test('swapHuzur - Disallowed if the 7 of Huzur suit was obtained by picking up from another player', () => {
      const p1 = new Player("p1");
      const sevenOfHearts = new Card(Suit.Hearts, Rank.Seven);
      p1.hand.push(...[sevenOfHearts]);

      // Simulate: the 7-of-trump came from a pickup event.
      (p1 as any).__lastPickedUpCardKeys = new Set([`${Suit.Hearts}:${Rank.Seven}:0`]);

      const faceUpHuzur = new Card(Suit.Hearts, Rank.Ace);
      const fakeState = { huzurSuit: Suit.Hearts, huzurCard: faceUpHuzur, deck: { length: 10 } } as any;

      const success = DurakEngine.swapHuzur(p1, fakeState);
      expect(success).toBe(false);
    });

    test('swapHuzur - Fails if deck is empty', () => {
      const p1 = new Player("p1");
      p1.hand.push(...[new Card(Suit.Hearts, Rank.Seven)]);
      const faceUpHuzur = new Card(Suit.Hearts, Rank.Ace);
      const fakeState = { huzurSuit: Suit.Hearts, huzurCard: faceUpHuzur, deck: { length: 0 } } as any;
      
      const success = DurakEngine.swapHuzur(p1, fakeState); // deckSize = 0
      expect(success).toBe(false);
    });

    test('swapHuzur - Fails if player does not have the 7 of Huzur suit', () => {
      const p1 = new Player("p1");
      p1.hand.push(...[new Card(Suit.Hearts, Rank.Eight)]); // Has 8 instead of 7
      const faceUpHuzur = new Card(Suit.Hearts, Rank.Ace);
      const fakeState = { huzurSuit: Suit.Hearts, huzurCard: faceUpHuzur, deck: { length: 10 } } as any;
      
      const success = DurakEngine.swapHuzur(p1, fakeState); 
      expect(success).toBe(false);
    });
  });

  describe('Drawing Logic', () => {
    test('computeDrawAmount - penalized player (hasPickedUp) only draws if < 5', () => {
      const p = new Player("p1");
      p.hasPickedUp = true;
      
      for(let i = 0; i < 4; i++) {
        p.hand.push(new Card());
      }
      expect(DurakEngine.computeDrawAmount(p, 10)).toBe(1);
    });

    test('computeDrawAmount - normal player draws to 5', () => {
      const p = new Player("p2");
      p.hand.push(new Card());
      expect(DurakEngine.computeDrawAmount(p, 10)).toBe(4);
    });
  });
});
