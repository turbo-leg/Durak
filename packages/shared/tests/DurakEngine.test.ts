import { expect, test, describe } from 'vitest';
import { DurakEngine } from '../src/engine/DurakEngine';
import { Card, Suit, Rank } from '../src/state/Card';
import { Player } from '../src/state/Player';

describe('DurakEngine - Custom Rules', () => {

  test('createDeck - verifies 42 cards (excluding 4,5,6)', () => {
    const deck = DurakEngine.createDeck();
    expect(deck).toHaveLength(42);
    // 7, 8, 9, 10, J, Q, K, 3, 2, A = 10 ranks. 10 * 4 = 40 + 2 jokers.
  });

  test('Rank Hierarchy - 3 < 2 < Ace < Black Joker < Red Joker', () => {
    const r3 = new Card(Suit.Hearts, Rank.Three);
    const r2 = new Card(Suit.Hearts, Rank.Two);
    const rA = new Card(Suit.Hearts, Rank.Ace);
    const bj = new Card(Suit.None, Rank.BlackJoker, true);
    const rj = new Card(Suit.None, Rank.RedJoker, true);

    expect(DurakEngine.compareStrength(r2, r3, Suit.Spades)).toBeGreaterThan(0);
    expect(DurakEngine.compareStrength(rA, r2, Suit.Spades)).toBeGreaterThan(0);
    expect(DurakEngine.compareStrength(bj, rA, Suit.Spades)).toBeGreaterThan(0);
    expect(DurakEngine.compareStrength(rj, bj, Suit.Spades)).toBeGreaterThan(0);
  });

  describe('Mass Attacks', () => {
    test('isValidMassAttack - exactly 3 cards required', () => {
       const pairPlusOne = [
         new Card(Suit.Hearts, Rank.Jack),
         new Card(Suit.Spades, Rank.Jack),
         new Card(Suit.Clubs, Rank.Seven)
       ];
       expect(DurakEngine.isValidMassAttack(pairPlusOne, [])).toBe(true);

       const pairOnly = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack)
       ];
       expect(DurakEngine.isValidMassAttack(pairOnly, [])).toBe(false);
    });

    test('isValidMassAttack - Joker cannot be the required pair', () => {
      const jokersAndSingle = [
        new Card(Suit.None, Rank.BlackJoker, true),
        new Card(Suit.None, Rank.RedJoker, true),
        new Card(Suit.Hearts, Rank.Seven)
      ];
      // Red + Black Joker is NOT a same-rank pair.
      expect(DurakEngine.isValidMassAttack(jokersAndSingle, [])).toBe(false);

      const pairWithJoker = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.None, Rank.RedJoker, true)
      ];
      // This works: Pair of Jacks + a Joker as the "any" card.
      expect(DurakEngine.isValidMassAttack(pairWithJoker, [])).toBe(true);
    });

    test('isValidMassAttack - blocked if any player has < 3 cards', () => {
      const pSmall = new Player("smol");
      pSmall.hand.push(new Card(Suit.Hearts, Rank.Seven));
      pSmall.hand.push(new Card(Suit.Hearts, Rank.Eight)); // Only 2 cards

      const cards = [
        new Card(Suit.Hearts, Rank.Jack),
        new Card(Suit.Spades, Rank.Jack),
        new Card(Suit.Clubs, Rank.Seven)
      ];
      expect(DurakEngine.isValidMassAttack(cards, [pSmall])).toBe(false);
    });
  });

  describe('Drawing Logic', () => {
    test('computeDrawAmount - penalized player (hasPickedUp) only draws if < 5', () => {
       const p = new Player("p1");
       p.hasPickedUp = true;
       // 6 cards in hand (from picking up)
       for(let i=0; i<6; i++) p.hand.push(new Card());

       expect(DurakEngine.computeDrawAmount(p, 10)).toBe(0);

       // Drops to 4
       p.hand.pop(); p.hand.pop(); 
       expect(DurakEngine.computeDrawAmount(p, 10)).toBe(1); // To reach 5
    });

    test('computeDrawAmount - normal player draws to 5', () => {
      const p = new Player("p2");
      p.hand.push(new Card());
      expect(DurakEngine.computeDrawAmount(p, 10)).toBe(4);
    });
  });

  describe('Mass Defense', () => {
    test('canDefendMass - matches defenders to attackers 1-to-1', () => {
      const attackers = [
        new Card(Suit.Hearts, Rank.Seven),
        new Card(Suit.Hearts, Rank.Eight),
        new Card(Suit.Spades, Rank.Ten)
      ];
      const defenders = [
        new Card(Suit.Hearts, Rank.Nine),
        new Card(Suit.Hearts, Rank.Ten),
        new Card(Suit.Diamonds, Rank.Seven) // Trump card? Let's check Suit behavior
      ];

      // Assuming Diamonds is Huzur
      expect(DurakEngine.canDefendMass(defenders, attackers, Suit.Diamonds)).toBe(true);
      // Seven of Diamonds (Huzur) beats Ten of Spades.
      // Nine of Hearts beats Seven of Hearts.
      // Ten of Hearts beats Eight of Hearts.
    });
  });
});
