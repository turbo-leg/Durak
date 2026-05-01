import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../../src/engine/DurakEngine';
import { GameState } from '../../src/state/GameState';

describe('3 Player FFA (7 Cards)', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['p1', 'p2', 'p3'], 7);
  });

  it('should initialize with 7 cards per player', () => {
    for (let i = 1; i <= 3; i++) {
      expect(state.players.get(`p${i}`)!.hand.length).toBe(7);
    }
    expect(state.deck.length).toBe(42 - 21);
  });
});
