import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../src/engine/DurakEngine';
import { Card, Suit, Rank } from '../src/state/Card';
import { GameState } from '../src/state/GameState';
import { Player } from '../src/state/Player';

/**
 * Reproduces the exact 4-player pickup duplication bug reported by user:
 *
 * dummy-dffut attacked: -8h, -9h, -9c      (3 cards to activeAttackCards)
 * dummy-ysvb2 defended: -Kh, -16h, -10c    (3 cards)
 * x77d1Atfl picked up                       (should get exactly 6 cards, got 9)
 *
 * The bug was that handleDefend pushed defense cards to BOTH table and
 * activeAttackCards, causing endRound to double-collect them.
 */
describe('Card Conservation - No Duplication on Pickup', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['p1', 'p2', 'p3', 'p4'], 5, 'classic');

    // Clear all hands and deck for controlled testing
    state.deck.splice(0, state.deck.length);
    state.table.splice(0, state.table.length);
    state.tableStacks.splice(0, state.tableStacks.length);
    state.activeAttackCards.splice(0, state.activeAttackCards.length);
    state.players.forEach((p) => p.hand.splice(0, p.hand.length));

    state.huzurSuit = Suit.Spades;
  });

  it('pickup after defend: no card duplication (4-player scenario)', () => {
    // Simulate the state AFTER p3 (dffut) attacked and p4 (ysvb2) defended:
    //
    // After defend, the flow should be:
    // - table (history) contains the attack cards: 8h, 9h, 9c
    // - activeAttackCards contains the defense cards: Kh, 16h(=2h), 10c
    // These are DISJOINT sets.

    const atk1 = new Card(Suit.Hearts, Rank.Eight);
    const atk2 = new Card(Suit.Hearts, Rank.Nine);
    const atk3 = new Card(Suit.Clubs, Rank.Nine);

    const def1 = new Card(Suit.Hearts, Rank.King);
    const def2 = new Card(Suit.Hearts, Rank.Ace); // 16h = Ace in our rank system
    const def3 = new Card(Suit.Clubs, Rank.Ten);

    // Attack cards moved to table (resolved history)
    state.table.push(atk1, atk2, atk3);

    // Defense cards are the new activeAttackCards
    state.activeAttackCards.push(def1, def2, def3);

    // p1 picks up
    const p1 = state.players.get('p1')!;
    DurakEngine.endRound(state, 'p1');

    // CRITICAL: p1 should have exactly 6 cards, not 9
    expect(p1.hand).toHaveLength(6);

    // Verify each card appears exactly once
    const cardKeys = p1.hand.map((c) => `${c.suit}:${c.rank}`);
    const uniqueKeys = new Set(cardKeys);
    // All 6 should be unique (since all 6 inputs were unique)
    expect(uniqueKeys.size).toBe(6);

    // Table and active should be cleared
    expect(state.table).toHaveLength(0);
    expect(state.activeAttackCards).toHaveLength(0);
    expect(state.tableStacks).toHaveLength(0);
  });

  it('successful round end: all cards go to discard pile, no duplication', () => {
    const atk1 = new Card(Suit.Hearts, Rank.Eight);
    const atk2 = new Card(Suit.Clubs, Rank.Nine);
    const def1 = new Card(Suit.Hearts, Rank.King);
    const def2 = new Card(Suit.Clubs, Rank.Ten);

    // Table has resolved history (attack cards)
    state.table.push(atk1, atk2);
    // Active has pending defense cards that will become discarded too
    state.activeAttackCards.push(def1, def2);

    DurakEngine.endRound(state, null);

    expect(state.discardPile).toHaveLength(4);
    expect(state.table).toHaveLength(0);
    expect(state.activeAttackCards).toHaveLength(0);
  });

  it('card conservation invariant: total cards = 42 through attack-defend-pickup cycle', () => {
    // Re-initialize with a real deck
    state = new GameState();
    DurakEngine.initializeGame(state, ['p1', 'p2'], 5, 'classic');
    state.huzurSuit = Suit.Diamonds;

    const countAllCards = () => {
      let total = state.deck.length + state.discardPile.length;
      total += state.table.length;
      total += state.activeAttackCards.length;
      state.players.forEach((p) => (total += p.hand.length));
      return total;
    };

    // After initialization, total should be 42
    expect(countAllCards()).toBe(42);

    // Simulate p1 attacking with 1 card
    const p1 = state.players.get('p1')!;
    const atkCard = p1.hand[0]!;
    p1.hand.splice(0, 1);
    state.activeAttackCards.push(new Card(atkCard.suit, atkCard.rank, atkCard.isJoker));

    expect(countAllCards()).toBe(42);

    // Simulate p2 picking up
    DurakEngine.endRound(state, 'p2');
    expect(countAllCards()).toBe(42);

    // Replenish
    DurakEngine.replenishAll(state);
    expect(countAllCards()).toBe(42);
  });

  it('defense cards correctly become activeAttackCards without duplication', () => {
    // Simulate: p1 attacks with 3 cards, p2 defends with 3 matching cards
    const p2 = state.players.get('p2')!;

    // Set up attack cards (pending defense)
    const atk1 = new Card(Suit.Hearts, Rank.Eight);
    const atk2 = new Card(Suit.Spades, Rank.Nine);
    const atk3 = new Card(Suit.Clubs, Rank.Seven);
    state.activeAttackCards.push(atk1, atk2, atk3);

    // Give p2 cards that can beat the attacks
    const def1 = new Card(Suit.Hearts, Rank.King); // beats 8h
    const def2 = new Card(Suit.Spades, Rank.Ten); // beats 9s
    const def3 = new Card(Suit.Clubs, Rank.Queen); // beats 7c
    p2.hand.push(def1, def2, def3);

    // Find the assignment
    const assignments = DurakEngine.findDefenseAssignment(
      [def1, def2, def3],
      [atk1, atk2, atk3],
      state.huzurSuit,
    );
    expect(assignments).not.toBeNull();
    expect(assignments).toHaveLength(3);

    // Simulate what handleDefend does AFTER the fix:
    // 1. Move attack cards to table (history) + tableStacks (visual)
    assignments!.forEach((pair) => {
      state.tableStacks.push(new Card(pair.atk.suit, pair.atk.rank, pair.atk.isJoker));
      state.tableStacks.push(new Card(pair.def.suit, pair.def.rank, pair.def.isJoker));
      state.table.push(new Card(pair.atk.suit, pair.atk.rank, pair.atk.isJoker));
    });

    // 2. Clear active attack cards
    state.activeAttackCards.splice(0, state.activeAttackCards.length);

    // 3. Defense cards become new active attacks
    assignments!.forEach((pair) => {
      const defCard = pair.def;
      const idx = p2.hand.findIndex((hc) => hc.suit === defCard.suit && hc.rank === defCard.rank);
      if (idx !== -1) {
        p2.hand.splice(idx, 1);
        state.activeAttackCards.push(new Card(defCard.suit, defCard.rank, defCard.isJoker));
      }
    });

    // Verify: table has 3 attack cards (history), active has 3 defense cards
    expect(state.table).toHaveLength(3);
    expect(state.activeAttackCards).toHaveLength(3);
    expect(p2.hand).toHaveLength(0);

    // Verify NO overlap between table and activeAttackCards
    const tableKeys = new Set(Array.from(state.table).map((c) => `${c!.suit}:${c!.rank}`));
    const activeKeys = new Set(
      Array.from(state.activeAttackCards).map((c) => `${c!.suit}:${c!.rank}`),
    );

    for (const key of activeKeys) {
      expect(tableKeys.has(key)).toBe(false);
    }

    // Now if p3 picks up, they should get exactly 6 cards
    const p3 = state.players.get('p3')!;
    DurakEngine.endRound(state, 'p3');
    expect(p3.hand).toHaveLength(6);
  });
});
