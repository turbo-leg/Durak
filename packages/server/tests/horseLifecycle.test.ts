import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card, Player } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';

function setup() {
  const room = new DurakRoom();
  const handlers = new Map<string, (...args: any[]) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'onMessage').mockImplementation(((
    type: string,
    callback: (...args: any[]) => void,
  ) => {
    handlers.set(type, callback);
    return () => {};
  }) as any);
  room.broadcast = vi.fn();
  room.onCreate({ mode: 'horse', maxPlayers: 4 });
  for (let i = 0; i < 4; i++) {
    const player = new Player(`p${i}`);
    player.team = i % 2;
    room.state.players.set(player.id, player);
    if (i) (room as any).botIds.set(player.id, 'easy');
  }
  vi.spyOn(room as any, 'startTurnTimer').mockImplementation(() => {});
  vi.spyOn(room as any, 'scheduleBotTurn').mockImplementation(() => {});
  let callback: () => void = () => {};
  const clear = vi.fn();
  vi.spyOn(room.clock, 'setTimeout').mockImplementation(((fn: () => void) => {
    callback = fn;
    return { clear };
  }) as any);
  room.state.phase = 'finished';
  return { room, vote: handlers.get('rematchVote')!, clear, fire: () => callback() };
}

afterEach(() => vi.restoreAllMocks());

describe('Horse match lifecycle', () => {
  it('continues after a drawn Horse game without adding a letter', () => {
    const { room, fire } = setup();
    room.state.phase = 'playing';
    // Players from both teams out at once: no team wins.
    room.state.seatOrder.push('p0', 'p1', 'p2', 'p3');
    (room as any).checkGameOver();
    expect(room.state.phase).toBe('finished');
    expect(room.state.horseTeamA).toBe('');
    expect(room.state.horseTeamB).toBe('');
    expect(room.state.horseGame).toBe(2);
    fire();
    expect(room.state.phase).toBe('waiting');
  });
  it('rejects sub-game rematches and returns to the lobby on the room clock', () => {
    const { room, vote, clear, fire } = setup();
    (room as any).handleHorseRoundEnd(0);
    expect(room.state.horseTeamA).toBe('H');
    vote({ sessionId: 'p0' }, { accept: true });
    expect(room.state.phase).toBe('finished');
    expect(clear).not.toHaveBeenCalled();
    fire();
    expect(room.state.phase).toBe('waiting');
    expect(room.state.horseGame).toBe(2);
    expect(room.state.horseTeamA).toBe('H');
  });

  it('cancels a pending Horse transition when a game starts; a stale callback cannot reset it', () => {
    const { room, clear, fire } = setup();
    (room as any).handleHorseRoundEnd(0);
    (room as any).startGame();
    expect(clear).toHaveBeenCalledOnce();
    expect(room.state.phase).toBe('playing');
    const hand = Array.from(room.state.players.get('p0')!.hand);
    fire();
    expect(room.state.phase).toBe('playing');
    expect(Array.from(room.state.players.get('p0')!.hand)).toEqual(hand);
  });

  it('announces the winning team and resets letters only for a completed-match rematch', () => {
    const { room, vote } = setup();
    room.state.horseTeamA = 'HORS';
    room.state.horseTeamB = 'HO';
    room.state.horseGame = 7;
    (room as any).handleHorseRoundEnd(0);
    expect(room.broadcast).toHaveBeenCalledWith('horseMatchOver', { winningTeam: 1 });
    expect(room.clock.setTimeout).not.toHaveBeenCalled();
    vote({ sessionId: 'p0' }, { accept: true });
    expect(room.state.phase).toBe('playing');
    expect(room.state.horseTeamA).toBe('');
    expect(room.state.horseTeamB).toBe('');
    expect(room.state.horseGame).toBe(1);
  });

  it('clears the Horse continuation on disposal', async () => {
    const { room, clear } = setup();
    (room as any).handleHorseRoundEnd(1);
    await room.onDispose();
    expect(clear).toHaveBeenCalledOnce();
  });

  it('logs printed custom ranks and distinct Jokers', () => {
    const { room } = setup();
    const format = (card: Card) => (room as any).formatCard(card);
    expect([14, 15, 16].map((rank) => format(new Card('Spades', rank)))).toEqual([
      '3s',
      '2s',
      'As',
    ]);
    expect(format(new Card('None', 17, true))).toBe('BJ');
    expect(format(new Card('None', 18, true))).toBe('RJ');
  });
});
