import { describe, it, expect } from 'vitest';
import { GameLog } from '../src/models/GameLog';

describe('GameLog Model', () => {
  it('should create a basic schema object without throwing errors', () => {
    // We don't want to connect to a real DB, so we'll just test the constructor
    const log = new GameLog({
      roomId: 'test-room',
      date: new Date(),
      mode: 'classic',
      players: ['p1', 'p2'],
      winners: ['p1'],
      durak: 'p2',
      actionLog: ['turn 0: p1: ♠6', 'p1 attacked: ♠6', 'p2 defended: ♠10', 'p1 picked up: ♠6, ♠10'],
    });

    const error = log.validateSync();
    expect(error).toBeUndefined(); // Assuming valid based on schema fields

    expect(log.roomId).toBe('test-room');
    expect(log.players.length).toBe(2);
    expect(log.durak).toBe('p2');
    expect(log.actionLog.length).toBe(4);
  });
});
