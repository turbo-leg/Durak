import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { DurakEngine } from '@durak/shared/src/engine/DurakEngine';
import { GameState } from '@durak/shared/src/state/GameState';
import { Player } from '@durak/shared/src/state/Player';
import { Card } from '@durak/shared/src/state/Card';
import type { Client } from 'colyseus';

function makeClient(sessionId: string): Client {
  return { sessionId } as unknown as Client;
}

describe('DurakRoom Disconnect Handling', () => {
  let room: DurakRoom;

  beforeEach(() => {
    vi.useFakeTimers();
    room = new DurakRoom();
    room.state = new GameState();
    room.broadcast = vi.fn();
    (room as any).checkGameOver = vi.fn();
    (room as any).startTurnTimer = vi.fn();

    // Setup a 2-player in-progress game
    room.state.phase = 'playing';
    room.state.seatOrder.push('p1', 'p2');
    room.state.currentTurn = 'p1';
    room.state.hostId = 'p1';

    const p1 = new Player('p1');
    p1.isReady = true;
    const p2 = new Player('p2');
    p2.isReady = true;
    room.state.players.set('p1', p1);
    room.state.players.set('p2', p2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('consented leave (lobby / intentional)', () => {
    it('immediately removes the player and reassigns host', async () => {
      room.state.phase = 'waiting';
      await room.onLeave(makeClient('p1'), true);

      expect(room.state.players.has('p1')).toBe(false);
      expect(room.state.hostId).toBe('p2');
    });
  });

  describe('unexpected disconnect during game', () => {
    it("auto-pickups after 5s if it is the disconnected player's turn", async () => {
      // active attack cards on the table
      room.state.activeAttackCards.push(new Card('spades', 10));

      const endRoundSpy = vi.spyOn(DurakEngine, 'endRound').mockImplementation(() => {});
      const replenishSpy = vi.spyOn(DurakEngine, 'replenishAll').mockImplementation(() => {});

      // allowReconnection never resolves during this test (simulate pending window)
      (room as any).allowReconnection = vi.fn(() => new Promise(() => {}));

      const leavePromise = room.onLeave(makeClient('p1'), false);

      // Before 5s: no pickup
      vi.advanceTimersByTime(4999);
      expect(endRoundSpy).not.toHaveBeenCalled();

      // After 5s: auto-pickup fires
      vi.advanceTimersByTime(1);
      expect(endRoundSpy).toHaveBeenCalledWith(room.state, 'p1');
      expect(replenishSpy).toHaveBeenCalled();

      leavePromise.catch(() => {}); // prevent unhandled rejection noise
    });

    it('does not auto-pickup if player is not the current turn', async () => {
      room.state.currentTurn = 'p2'; // p1 is NOT the current turn
      room.state.activeAttackCards.push(new Card('hearts', 7));

      const endRoundSpy = vi.spyOn(DurakEngine, 'endRound').mockImplementation(() => {});
      (room as any).allowReconnection = vi.fn(() => new Promise(() => {}));

      room.onLeave(makeClient('p1'), false).catch(() => {});

      vi.advanceTimersByTime(10000);
      expect(endRoundSpy).not.toHaveBeenCalled();
    });

    it('permanently removes player and skips turn after reconnect window expires', async () => {
      room.state.currentTurn = 'p2'; // p1 is not the current attacker

      // allowReconnection immediately rejects (window expired)
      (room as any).allowReconnection = vi.fn(() => Promise.reject(new Error('timeout')));

      await room.onLeave(makeClient('p1'), false);

      expect(room.state.players.has('p1')).toBe(false);
      expect(room.state.seatOrder.includes('p1')).toBe(false);
      // p2 becomes host
      expect(room.state.hostId).toBe('p2');
    });

    it('ends the game when only 1 player remains after permanent removal', async () => {
      (room as any).allowReconnection = vi.fn(() => Promise.reject(new Error('timeout')));

      await room.onLeave(makeClient('p1'), false);

      expect(room.state.phase).toBe('finished');
    });

    it('clears pickup timer if player reconnects before 5s', async () => {
      room.state.activeAttackCards.push(new Card('clubs', 9));
      const endRoundSpy = vi.spyOn(DurakEngine, 'endRound').mockImplementation(() => {});

      // allowReconnection resolves immediately (reconnect success)
      (room as any).allowReconnection = vi.fn(() => Promise.resolve());

      await room.onLeave(makeClient('p1'), false);

      // Advance past 5s - timer should have been cleared
      vi.advanceTimersByTime(10000);
      expect(endRoundSpy).not.toHaveBeenCalled();
    });
  });
});
