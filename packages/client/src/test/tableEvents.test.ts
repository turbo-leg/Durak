import { describe, expect, it } from 'vitest';
import { SELF, tableEvents } from '../game/tableEvents';
import type { TableCard, TableSeat, TableSnapshot } from '../game/tableSnapshot';

const card = (key: string): TableCard => ({ key, suit: 'Hearts', rank: 10, isJoker: false });
const seat = (id: string, count: number, played = 0, escaped = false): TableSeat => ({
  id,
  name: id,
  count,
  played,
  escaped,
  active: false,
});
function table(overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    signature: '',
    hand: [card('a'), card('b')],
    attacks: [],
    history: [],
    seats: [seat('peer', 5)],
    huzur: card('h'),
    deckCount: 10,
    discardCount: 0,
    canSelect: false,
    self: { preset: 'copper', played: 0 },
    ...overrides,
  };
}

describe('Table events', () => {
  it('reports nothing for the first snapshot a viewer sees', () => {
    expect(tableEvents(undefined, table())).toEqual([]);
  });

  it('attributes newly played cards to the seat whose play sequence advanced', () => {
    const before = table();
    const after = table({ attacks: [card('x')], seats: [seat('peer', 4, 1)] });
    expect(tableEvents(before, after)).toEqual([{ kind: 'play', seat: 'peer', cards: ['x'] }]);
  });

  it('reports the local player playing from their own hand', () => {
    const before = table();
    const after = table({
      hand: [card('a')],
      attacks: [card('b')],
      self: { preset: 'copper', played: 1 },
    });
    expect(tableEvents(before, after)).toEqual([{ kind: 'play', seat: SELF, cards: ['b'] }]);
  });

  it('tells a pickup (table cleared, nothing discarded) from a draw (deck shrinks)', () => {
    const fought = table({ attacks: [card('x')], history: [card('y'), card('z')] });
    const pickup = table({ seats: [seat('peer', 8)] });
    expect(tableEvents(fought, pickup)).toEqual([{ kind: 'pickup', seat: 'peer' }]);
    const draw = table({
      seats: [seat('peer', 6)],
      deckCount: 7,
      hand: [card('a'), card('b'), card('c')],
    });
    expect(tableEvents(table(), draw)).toEqual([
      { kind: 'draw', seat: 'peer', count: 1 },
      { kind: 'draw', seat: SELF, count: 1 },
    ]);
  });

  it('names the winners and players left holding cards when a game ends', () => {
    const playing = table({ seats: [seat('peer', 1)] });
    const finished = table({
      betweenGames: true,
      resultVisible: true,
      hand: [],
      seats: [seat('peer', 1)],
      self: { preset: 'copper', played: 0, escaped: true },
    });
    expect(tableEvents(playing, finished)).toEqual([
      { kind: 'gameOver', winners: [SELF], losers: ['peer'], teamWin: false },
    ]);
  });

  it('recognizes a team result once and includes a teammate still holding cards', () => {
    const winningSeat = { ...seat('peer', 3, 0, true), team: 0 };
    const playing = table({ seats: [winningSeat], teamMode: true });
    const finished = table({
      seats: [winningSeat],
      teamMode: true,
      winnerTeam: 0,
      resultVisible: true,
      betweenGames: true,
      self: { preset: 'copper', played: 0, escaped: true },
    });
    expect(tableEvents(playing, finished)).toEqual([
      { kind: 'gameOver', winners: ['peer', SELF], losers: [], teamWin: true },
    ]);
    expect(tableEvents(finished, finished)).toEqual([]);
  });

  it('includes both losing teammates, including the local player', () => {
    const seats = [seat('winner', 0, 0, true), seat('loser', 3)];
    const before = table({ seats, teamMode: true });
    const after = table({ seats, teamMode: true, winnerTeam: 0, resultVisible: true });
    expect(tableEvents(before, after)).toEqual([
      { kind: 'gameOver', winners: ['winner'], losers: ['loser', SELF], teamWin: true },
    ]);
  });

  it('does not celebrate either side of a draw', () => {
    const before = table();
    const after = table({
      resultVisible: true,
      resultDraw: true,
      betweenGames: true,
      seats: [seat('peer', 0, 0, true)],
      hand: [],
      self: { preset: 'copper', played: 0, escaped: true },
    });
    expect(tableEvents(before, after)).toEqual([
      { kind: 'gameOver', winners: [], losers: [], teamWin: false },
    ]);
  });

  it('never invents events for a spectator, who has no hand of their own', () => {
    const before = table({ spectator: true, hand: [] });
    const after = table({ spectator: true, hand: [], deckCount: 9, seats: [seat('peer', 6)] });
    expect(tableEvents(before, after)).toEqual([{ kind: 'draw', seat: 'peer', count: 1 }]);
  });
});
