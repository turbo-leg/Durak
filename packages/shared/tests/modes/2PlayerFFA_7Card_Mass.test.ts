import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../../src/engine/DurakEngine';
import { GameState } from '../../src/state/GameState';
import { Card, Suit, Rank } from '../../src/state/Card';

describe('2 Player FFA (7 Cards) - 5-Card Mass Attack', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['p1', 'p2'], 7);
  });

  it('should allow 5-card mass attack in 7-card lobby even if deck is not empty', () => {
    const atkCards = [
      new Card(Suit.Spades, Rank.Eight, false),
      new Card(Suit.Hearts, Rank.Eight, false),
      new Card(Suit.Clubs, Rank.Nine, false),
      new Card(Suit.Diamonds, Rank.Nine, false),
      new Card(Suit.Spades, Rank.King, false),
    ];

    const p1 = state.players.get('p1')!;
    const p2 = state.players.get('p2')!;
    const allPlayers = [p1, p2];

    // Deck is NOT empty, but targetHandSize=7 so 5-card mass is allowed
    expect(state.deck.length).toBeGreaterThan(0);
    expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, state.deck.length, 7)).toBe(true);
  });

  it('should NOT allow 5-card mass attack in 5-card lobby when deck is not empty', () => {
    const atkCards = [
      new Card(Suit.Spades, Rank.Eight, false),
      new Card(Suit.Hearts, Rank.Eight, false),
      new Card(Suit.Clubs, Rank.Nine, false),
      new Card(Suit.Diamonds, Rank.Nine, false),
      new Card(Suit.Spades, Rank.King, false),
    ];

    const p1 = state.players.get('p1')!;
    const p2 = state.players.get('p2')!;
    const allPlayers = [p1, p2];

    // targetHandSize=5, deck not empty — blocked
    expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, state.deck.length, 5)).toBe(false);
  });

  it('should allow 5-card mass attack in 5-card lobby when deck IS empty', () => {
    const atkCards = [
      new Card(Suit.Spades, Rank.Eight, false),
      new Card(Suit.Hearts, Rank.Eight, false),
      new Card(Suit.Clubs, Rank.Nine, false),
      new Card(Suit.Diamonds, Rank.Nine, false),
      new Card(Suit.Spades, Rank.King, false),
    ];

    const p1 = state.players.get('p1')!;
    const p2 = state.players.get('p2')!;
    const allPlayers = [p1, p2];

    expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, 0, 5)).toBe(true);
  });

  it('should still allow 3-card mass attack with non-empty deck in any lobby', () => {
    const atkCards = [
      new Card(Suit.Spades, Rank.Eight, false),
      new Card(Suit.Hearts, Rank.Eight, false),
      new Card(Suit.Clubs, Rank.King, false),
    ];

    const p1 = state.players.get('p1')!;
    const p2 = state.players.get('p2')!;
    const allPlayers = [p1, p2];

    expect(state.deck.length).toBeGreaterThan(0);
    expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, state.deck.length, 7)).toBe(true);
    expect(DurakEngine.isValidMassAttack(atkCards, allPlayers, state.deck.length, 5)).toBe(true);
  });
});
