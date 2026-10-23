import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { GameState } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';

// Bots think for 0.8–2 s after their turn begins; allow for that in waits.
const SLOW_WAIT = { timeout: 6000, interval: 50 };

describe('temporary bot control on private tables', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (s: any) => s.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2585,
    );
  });
  afterEach(async () => server.cleanup());
  afterAll(async () => server.shutdown());

  /** Two guests, readied and past the opening, with the first player's client identified. */
  async function liveTable(takeoverMs: number) {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: { countdownMs: 20, openingMs: 20, takeoverMs },
    });
    const a = await server.connectTo(room, { username: 'A' });
    const b = await server.connectTo(room, { username: 'B' });
    for (const c of [a, b]) c.onMessage('*', () => {});
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(room.state.phase).toBe('playing'));
    const first = room.state.currentTurn === a.sessionId ? a : b;
    const second = first === a ? b : a;
    return { room, a, b, first, second };
  }

  async function drop(room: { clients: { sessionId: string }[] }, client: Room<GameState>) {
    const token = client.reconnectionToken;
    client.connection.close();
    await vi.waitFor(() =>
      expect(room.clients.some((c) => c.sessionId === client.sessionId)).toBe(false),
    );
    return token;
  }

  async function reconnect(token: string) {
    const restored = await server.sdk.reconnect<GameState>(token);
    restored.onMessage('*', () => {});
    return restored;
  }

  it('marks a lost connection at once and restores the human before takeover', async () => {
    const { room, first } = await liveTable(5000);
    const seat = room.state.players.get(first.sessionId)!;
    const token = await drop(room, first);
    expect(seat.connected).toBe(false);
    expect(seat.control).toBe('human');
    const restored = await reconnect(token);
    await vi.waitFor(() => expect(seat.connected).toBe(true));
    expect(seat.control).toBe('human');
    expect(room.state.currentTurn).toBe(restored.sessionId);
    // The original turn deadline is kept.
    expect(room.state.turnStartTime).toBeGreaterThan(0);
  });

  it('cancels a stand-in’s pending decision when the person returns during bot thinking', async () => {
    const { room, first } = await liveTable(30);
    const seat = room.state.players.get(first.sessionId)!;
    const hand = seat.hand.length;
    const token = await drop(room, first);
    await vi.waitFor(() => expect(seat.control).toBe('standin'));
    // Back within the bot's minimum thinking time.
    await reconnect(token);
    await vi.waitFor(() => expect(seat.control).toBe('human'));
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(room.state.currentTurn).toBe(first.sessionId);
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(seat.hand.length).toBe(hand);
  }, 15000);

  it('keeps a stand-in’s accepted move after the person reconnects', async () => {
    const { room, first, second } = await liveTable(30);
    const seat = room.state.players.get(first.sessionId)!;
    const token = await drop(room, first);
    await vi.waitFor(() => expect(seat.control).toBe('standin'));
    // The Easy stand-in leads through the same authoritative action path.
    await vi.waitFor(() => expect(room.state.currentTurn).toBe(second.sessionId), SLOW_WAIT);
    const attack = room.state.activeAttackCards.length;
    expect(attack).toBeGreaterThan(0);
    const restored = await reconnect(token);
    await vi.waitFor(() => expect(seat.control).toBe('human'));
    expect(room.state.activeAttackCards.length).toBe(attack);
    await vi.waitFor(() =>
      expect(restored.state.players.get(restored.sessionId)?.hand.length).toBe(seat.hand.length),
    );
  }, 15000);

  it('hands the seat to a bot at once on explicit departure, moves host, and releases it at game end', async () => {
    const { room, a, b } = await liveTable(5000);
    expect(room.state.hostId).toBe(a.sessionId);
    await a.leave(true);
    const seat = room.state.players.get(a.sessionId)!;
    await vi.waitFor(() => expect(seat.control).toBe('standin'));
    expect(seat.connected).toBe(false);
    expect(room.state.players.size).toBe(2); // the seat is reserved for this game
    expect(room.state.hostId).toBe(b.sessionId);

    // A disconnected human or stand-in never readies for the next game.
    room.state.deck.splice(0, room.state.deck.length);
    // The stand-in plays the departed seat out first, so that seat wins.
    seat.hand.splice(0);
    (room as any).checkGameOver();
    await vi.waitFor(() => expect(b.state.phase).toBe('finished'));
    expect(room.state.players.has(a.sessionId)).toBe(false);
    expect(room.state.players.has(b.sessionId)).toBe(true);
    // The result survives the released seat.
    expect(Array.from(b.state.winners)).toEqual([a.sessionId]);
    expect(b.state.winnerName).toBe('A');
  });

  it('releases a disconnected seat at game end; a late reconnection cannot reclaim it', async () => {
    const { room, first, second } = await liveTable(5000);
    const token = await drop(room, first);
    room.state.deck.splice(0, room.state.deck.length);
    room.state.players.get(second.sessionId)!.hand.splice(0);
    (room as any).checkGameOver();
    await vi.waitFor(() => expect(room.state.players.has(first.sessionId)).toBe(false));
    await expect(server.sdk.reconnect(token)).rejects.toThrow();
    // A table needs its seats again before anything starts; the remaining human stays seated.
    expect(room.state.phase).toBe('finished');
    expect(room.state.players.has(second.sessionId)).toBe(true);
  });
});
