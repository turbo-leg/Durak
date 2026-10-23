import { describe, expect, it } from 'vitest';
import { Card, GameState, Player } from '@durak/shared';
import { cardLabel, tableSnapshot } from '../game/tableSnapshot';

function fixture() {
  const state = new GameState();
  const a = new Player('a');
  const b = new Player('b');
  const c = new Player('c');
  a.hand.push(new Card('Hearts', 14));
  b.hand.push(new Card('Clubs', 16));
  b.handCount = 7;
  state.players.set('a', a);
  state.players.set('b', b);
  state.players.set('c', c);
  state.seatOrder.push('a', 'b', 'c');
  state.currentTurn = 'a';
  state.phase = 'playing';
  state.deckCount = 17;
  state.deck.push(new Card('Spades', 16));
  return { state, a, b };
}

describe('immutable public table presentation', () => {
  it.each([2, 3, 4, 5, 6])(
    'preserves the seat order for a %i-player table from every chair',
    (count) => {
      const state = new GameState();
      const ids = Array.from({ length: count }, (_, i) => `seat:${i}`);
      for (const id of ids) {
        state.players.set(id, new Player(id));
        state.seatOrder.push(id);
      }
      ids.forEach((id, index) => {
        expect(tableSnapshot(state, id, false).seats.map((seat) => seat.id)).toEqual([
          ...ids.slice(index + 1),
          ...ids.slice(0, index),
        ]);
      });
    },
  );
  it('copies only local hand values and uses public opponent/deck counts', () => {
    const { state } = fixture();
    const view = tableSnapshot(state, 'a', false);
    expect(view.hand.map((c) => c.rank)).toEqual([14]);
    expect(view.seats[0]?.count).toBe(7);
    expect(view.deckCount).toBe(17);
    expect(JSON.stringify(view)).not.toContain('Clubs');
    expect(view.canSelect).toBe(true);
  });

  it('keeps old snapshots stable when a schema mutates in place', () => {
    const { state, a } = fixture();
    const before = tableSnapshot(state, 'a', false);
    a.hand[0]!.rank = 15;
    const after = tableSnapshot(state, 'a', false);
    expect(before.hand[0]?.rank).toBe(14);
    expect(after.signature).not.toBe(before.signature);
  });

  it('preserves clockwise seats relative to the local player', () => {
    const { state } = fixture();
    expect(tableSnapshot(state, 'b', false).seats.map((s) => s.id)).toEqual(['c', 'a']);
  });
  it('copies avatar presence without including opponent card identities', () => {
    const { state, b } = fixture();
    b.avatarPreset = 'indigo';
    b.headYaw = 0.4;
    b.headPitch = -0.2;
    b.playSequence = 3;
    const view = tableSnapshot(state, 'a', false);
    expect(view.seats[0]).toMatchObject({ preset: 'indigo', yaw: 0.4, pitch: -0.2, played: 3 });
    expect(JSON.stringify(view)).not.toContain('Clubs');
    b.headYaw = -0.5;
    expect(view.seats[0]?.yaw).toBe(0.4);
  });

  it('never gives a spectator a hand or selection even with a seated session ID', () => {
    const { state } = fixture();
    const view = tableSnapshot(state, 'a', true);
    expect(view.hand).toEqual([]);
    expect(view.canSelect).toBe(false);
    expect(view.seats.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('names the custom high ranks and Jokers correctly for accessible controls', () => {
    expect(cardLabel(new Card('Hearts', 14))).toBe('3 of Hearts');
    expect(cardLabel(new Card('Hearts', 15))).toBe('2 of Hearts');
    expect(cardLabel(new Card('None', 18, true))).toBe('Red Joker');
  });
});
