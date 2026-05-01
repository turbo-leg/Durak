import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../../src/engine/DurakEngine';
import { GameState } from '../../src/state/GameState';

describe('6 Player FFA (5 Cards)', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 5);
  });

  it('should initialize with 5 cards per player', () => {
    for (let i = 1; i <= 6; i++) {
      expect(state.players.get(`p${i}`)!.hand.length).toBe(5);
    }
    expect(state.deck.length).toBe(42 - 30);
  });
});
