import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../../src/engine/DurakEngine';
import { GameState } from '../../src/state/GameState';

describe('6 Player Teams (5 Cards)', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['t1p1', 't2p1', 't1p2', 't2p2', 't1p3', 't2p3'], 5, 'teams');
  });

  it('should initialize with 5 cards per player and assign teams', () => {
    const team1 = ['t1p1', 't1p2', 't1p3'];
    const team2 = ['t2p1', 't2p2', 't2p3'];

    for (const id of team1) {
      expect(state.players.get(id)!.hand.length).toBe(5);
      expect(state.players.get(id)!.team).toBe(0);
    }

    for (const id of team2) {
      expect(state.players.get(id)!.hand.length).toBe(5);
      expect(state.players.get(id)!.team).toBe(1);
    }

    expect(state.deck.length).toBe(42 - 30);
  });
});
