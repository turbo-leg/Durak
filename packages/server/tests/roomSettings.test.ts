import { describe, expect, it } from 'vitest';
import { roomSettings } from '../src/rooms/roomSettings';

describe('room configuration validation', () => {
  it('preserves the existing default and accepts explicit numeric strings', () => {
    expect(roomSettings({})).toEqual({
      mode: 'classic',
      maxPlayers: 6,
      targetHandSize: 5,
      teamSelection: 'random',
    });
    expect(roomSettings({ maxPlayers: '2', handSize: '7' }).targetHandSize).toBe(7);
  });

  it.each(['classic', 'teams', 'horse'])('accepts supported %s rooms', (mode) => {
    expect(roomSettings({ mode, maxPlayers: 4, handSize: 7, teamSelection: 'manual' }).mode).toBe(
      mode,
    );
  });

  it.each([
    null,
    [],
    'room',
    { maxPlayers: 0 },
    { maxPlayers: -1 },
    { maxPlayers: 99 },
    { maxPlayers: 2.5 },
    { maxPlayers: '2junk' },
    { maxPlayers: 'Infinity' },
    { mode: 'unknown' },
    { mode: {} },
    { mode: 'teams', maxPlayers: 3 },
    { mode: 'horse', maxPlayers: 5 },
    { handSize: 6 },
    { handSize: NaN },
    { handSize: [5] },
    { teamSelection: 'anything' },
  ])('rejects invalid input %j', (input) => {
    expect(() => roomSettings(input)).toThrow();
  });

  it('validates a partial settings update without mutating its current state', () => {
    const current = roomSettings({ maxPlayers: 3 });
    expect(() => roomSettings({ mode: 'teams', targetHandSize: 7 }, current)).toThrow();
    expect(current).toEqual({
      mode: 'classic',
      maxPlayers: 3,
      targetHandSize: 5,
      teamSelection: 'random',
    });
  });
});
