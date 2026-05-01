import { describe, it, expect, beforeEach } from 'vitest';
import { DurakEngine } from '../../src/engine/DurakEngine';
import { GameState } from '../../src/state/GameState';

describe('4 Player Teams (7 Cards)', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    DurakEngine.initializeGame(state, ['t1p1', 't2p1', 't1p2', 't2p2'], 7, 'teams');
  });

  it('should initialize with 7 cards per player and assign teams', () => {
    expect(state.players.get('t1p1')!.hand.length).toBe(7);
    expect(state.players.get('t1p1')!.team).toBe(0);

    expect(state.players.get('t2p1')!.hand.length).toBe(7);
    expect(state.players.get('t2p1')!.team).toBe(1);

    expect(state.players.get('t1p2')!.hand.length).toBe(7);
    expect(state.players.get('t1p2')!.team).toBe(0);

    expect(state.players.get('t2p2')!.hand.length).toBe(7);
    expect(state.players.get('t2p2')!.team).toBe(1);

    expect(state.deck.length).toBe(42 - 28);
  });
});
