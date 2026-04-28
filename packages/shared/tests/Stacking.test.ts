import { expect, test, describe } from 'vitest';
import { DurakEngine } from '../src/engine/DurakEngine';
import { Card, Suit, Rank } from '../src/state/Card';
import { GameState } from '../src/state/GameState';
import { Player } from '../src/state/Player';

describe('DurakEngine - Stacking and Round End', () => {

  test('endRound - successfully moves cards to discardPile when no pickerUpperId', () => {
    const state = new GameState();
    const c1 = new Card(Suit.Hearts, Rank.Eight);
    const c2 = new Card(Suit.Hearts, Rank.Nine);
    const c3 = new Card(Suit.Hearts, Rank.Ten);

    state.table.push(c1);
    state.table.push(c2);
    state.activeAttackCards.push(c3);
    state.tableStacks.push(c1);
    state.tableStacks.push(c2);

    DurakEngine.endRound(state, null);

    expect(state.discardPile.length).toBe(3);
    expect(state.table.length).toBe(0);
    expect(state.tableStacks.length).toBe(0);
    expect(state.activeAttackCards.length).toBe(0);
  });

  test('endRound - moves all table cards to player hand when pickerUpperId is provided', () => {
    const state = new GameState();
    const player = new Player();
    player.id = 'player1';
    state.players.set(player.id, player);

    const c1 = new Card(Suit.Hearts, Rank.Eight);
    const c2 = new Card(Suit.Hearts, Rank.Nine);
    
    state.table.push(c1);
    state.activeAttackCards.push(c2);
    state.tableStacks.push(c1);

    DurakEngine.endRound(state, 'player1');

    expect(player.hand.length).toBe(2);
    expect(state.discardPile.length).toBe(0);
    expect(state.table.length).toBe(0);
    expect(state.tableStacks.length).toBe(0);
    expect(player.lastDrawLog.length).toBeGreaterThan(0);
  });

  test('endRound - does not duplicate cards that appear in both table and active attacks', () => {
    const state = new GameState();
    const player = new Player();
    player.id = 'player1';
    state.players.set(player.id, player);

    const sharedCard = new Card(Suit.Hearts, Rank.Nine);
    const tableCard = new Card(Suit.Spades, Rank.Eight);

    state.table.push(tableCard);
    state.table.push(sharedCard);
    state.activeAttackCards.push(sharedCard);

    DurakEngine.endRound(state, 'player1');

    expect(player.hand).toHaveLength(2);
    expect(player.hand.filter((card) => card.suit === Suit.Hearts && card.rank === Rank.Nine)).toHaveLength(1);
    expect(player.hand.filter((card) => card.suit === Suit.Spades && card.rank === Rank.Eight)).toHaveLength(1);
    expect(player.lastDrawLog).toHaveLength(2);
  });

  test('handleDefend Logic Simulation - Pairing verification', () => {
    // We simulate the logic inside handleDefend for pairing
    const huzurSuit = Suit.Diamonds;
    const atkCards = [
        new Card(Suit.Hearts, Rank.Nine),
        new Card(Suit.Clubs, Rank.Eight)
    ];
    const defCards = [
        new Card(Suit.Clubs, Rank.Ten),
        new Card(Suit.Hearts, Rank.Ace)
    ];

    const assignments: { atk: Card, def: Card }[] = [];
    const usedDef = new Set<number>();
    
    const findAssignment = (idx: number): boolean => {
      if (idx === atkCards.length) return true;
      for (let i = 0; i < defCards.length; i++) {
        if (usedDef.has(i)) continue;
        if (DurakEngine.canDefend(defCards[i], atkCards[idx], huzurSuit)) {
          usedDef.add(i);
          assignments.push({ atk: atkCards[idx], def: defCards[i] });
          if (findAssignment(idx + 1)) return true;
          assignments.pop();
          usedDef.delete(i);
        }
      }
      return false;
    };

    const success = findAssignment(0);
    expect(success).toBe(true);
    expect(assignments).toHaveLength(2);
    
    // Check if 9H is paired with AH and 8C with 10C
    const pair1 = assignments.find(a => a.atk.rank === Rank.Nine && a.atk.suit === Suit.Hearts);
    expect(pair1?.def.rank).toBe(Rank.Ace);
    
    const pair2 = assignments.find(a => a.atk.rank === Rank.Eight && a.atk.suit === Suit.Clubs);
    expect(pair2?.def.rank).toBe(Rank.Ten);
  });

  test('ReplenishAll - draws correct amount and formats lastDrawLog with + prefix', () => {
    const state = new GameState();
    state.targetHandSize = 5;
    
    const player = new Player();
    player.id = 'p1';
    // Give player 3 cards
    player.hand.push(new Card(Suit.Spades, Rank.Seven));
    player.hand.push(new Card(Suit.Spades, Rank.Eight));
    player.hand.push(new Card(Suit.Spades, Rank.Nine));
    state.players.set(player.id, player);

    // Deck has 10 cards
    for(let i=0; i<10; i++) state.deck.push(new Card(Suit.Hearts, Rank.Seven));

    DurakEngine.replenishAll(state);

    expect(player.hand.length).toBe(5);
    expect(player.lastDrawLog.length).toBe(2);
    expect(player.lastDrawLog[0]).toContain('+');
  });

});
