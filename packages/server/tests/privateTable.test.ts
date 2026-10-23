import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { GameState, Player } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';

// Short test-only timings; production uses COUNTDOWN_MS / OPENING_MS.
const FAST = { countdownMs: 60, openingMs: 60 };
const SLOW = { countdownMs: 5000, openingMs: 60 };

describe('private table lifecycle over the network', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (s: any) => s.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2583,
    );
  });
  afterEach(async () => server.cleanup());
  afterAll(async () => server.shutdown());

  async function table(options: Record<string, unknown> = {}, guests = 2) {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: FAST,
      ...options,
    });
    const clients: Room<GameState>[] = [];
    for (let i = 0; i < guests; i++) {
      const client = await server.connectTo(room, { username: `Guest ${i + 1}` });
      client.onMessage('*', () => {});
      clients.push(client);
    }
    return { room, clients };
  }

  async function barrier(room: { waitForMessage(t: string): Promise<unknown> }, c: Room) {
    const seen = room.waitForMessage('ping');
    c.send('ping', { clientTime: Date.now() });
    await seen;
  }

  function finish(room: { state: GameState }, winner: string) {
    room.state.deck.splice(0, room.state.deck.length);
    const p = room.state.players.get(winner)!;
    p.hand.splice(0, p.hand.length);
    (room as any).checkGameOver();
  }

  it('lets two invited guests ready, start automatically, finish and play again in the same room', async () => {
    // Long enough for clients to observe each phase over the patch interval.
    const { room, clients } = await table({
      lifecycleTiming: { countdownMs: 300, openingMs: 300 },
    });
    const [a, b] = clients as [Room<GameState>, Room<GameState>];
    // Nobody is ready by default, including the host.
    expect(Array.from(room.state.players.values()).every((p) => !p.isReady)).toBe(true);

    a.send('toggleReady', { isReady: true });
    await barrier(room, a);
    expect(room.state.phase).toBe('waiting');
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(b.state.phase).toBe('countdown'));
    expect(b.state.phaseEndsAt).toBeGreaterThan(0);

    await vi.waitFor(() => expect(b.state.phase).toBe('opening'));
    // The opening is public and does not consume the first player's turn time.
    expect(b.state.turnStartTime).toBe(0);
    expect(b.state.currentTurn).not.toBe('');
    expect(b.state.openingDraws.length).toBe(2);
    expect(b.state.players.get(b.sessionId)?.hand.length).toBe(5);

    // Actions are rejected until the opening ends.
    const first = room.state.currentTurn === a.sessionId ? a : b;
    const card = room.state.players.get(first.sessionId)!.hand[0]!;
    first.send('attack', { cards: [{ suit: card.suit, rank: card.rank, isJoker: card.isJoker }] });
    await barrier(room, first);
    expect(room.state.activeAttackCards.length).toBe(0);

    await vi.waitFor(() => expect(b.state.phase).toBe('playing'));
    expect(room.state.turnStartTime).toBeGreaterThan(0);
    expect(room.state.phaseEndsAt).toBe(0);

    finish(room, a.sessionId);
    await vi.waitFor(() => expect(b.state.phase).toBe('finished'));
    expect(Array.from(room.state.winners)).toEqual([a.sessionId]);
    // Readiness resets; rematch voting is replaced on private tables.
    expect(Array.from(room.state.players.values()).every((p) => !p.isReady)).toBe(true);
    a.send('rematchVote', { accept: true });
    b.send('rematchVote', { accept: true });
    await barrier(room, b);
    expect(room.state.phase).toBe('finished');

    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(b.state.phase).toBe('playing'));
    expect(room.state.players.size).toBe(2);
    expect(room.state.outcome).toBe('');
    expect(b.state.players.get(b.sessionId)?.hand.length).toBe(5);
  });

  it('cancels the countdown when a player unreadies, and on settings changes resets readiness', async () => {
    const { room, clients } = await table({ lifecycleTiming: SLOW });
    const [a, b] = clients as [Room<GameState>, Room<GameState>];
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(room.state.phase).toBe('countdown'));

    b.send('toggleReady', { isReady: false });
    await vi.waitFor(() => expect(room.state.phase).toBe('waiting'));
    expect(room.state.phaseEndsAt).toBe(0);
    expect(room.state.players.get(a.sessionId)!.isReady).toBe(true);

    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(room.state.phase).toBe('countdown'));
    a.send('updateSettings', { targetHandSize: 7 });
    await vi.waitFor(() => expect(room.state.phase).toBe('waiting'));
    expect(room.state.targetHandSize).toBe(7);
    expect(Array.from(room.state.players.values()).every((p) => !p.isReady)).toBe(true);
  });

  it('requires every selected seat; host bots count toward seats and can be removed', async () => {
    const { room, clients } = await table({ maxPlayers: 4 });
    const [a, b] = clients as [Room<GameState>, Room<GameState>];
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await barrier(room, b);
    expect(room.state.phase).toBe('waiting');

    b.send('addBot', { difficulty: 'easy' }); // not the host
    await barrier(room, b);
    expect(room.state.players.size).toBe(2);

    a.send('addBot', { difficulty: 'easy' });
    await vi.waitFor(() => expect(room.state.players.size).toBe(3));
    const bot = Array.from(room.state.players.values()).find((p) => p.control === 'bot')!;
    expect(bot.isReady).toBe(true);
    a.send('removeBot', { playerId: b.sessionId }); // humans cannot be removed
    a.send('removeBot', { playerId: bot.id });
    await vi.waitFor(() => expect(room.state.players.size).toBe(2));
    expect(room.state.players.has(b.sessionId)).toBe(true);

    a.send('addBot', { difficulty: 'hard' });
    a.send('addBot', { difficulty: 'easy' });
    // A bot filling the last seat starts the countdown when everyone is ready.
    await vi.waitFor(() => expect(room.state.phase).not.toBe('waiting'));
    a.send('addBot', { difficulty: 'easy' }); // table is full
    await vi.waitFor(() => expect(room.state.phase).toBe('playing'));
    expect(room.state.players.size).toBe(4);
    expect(room.state.seatOrder.length).toBe(4);
  });

  it('blocks unbalanced manual teams', async () => {
    const { room, clients } = await table({
      mode: 'teams',
      maxPlayers: 4,
      teamSelection: 'manual',
    });
    const [a, b] = clients as [Room<GameState>, Room<GameState>];
    a.send('addBot', { difficulty: 'easy' });
    a.send('addBot', { difficulty: 'easy' });
    await vi.waitFor(() => expect(room.state.players.size).toBe(4));
    // One blue against three red.
    room.state.players.forEach((p) => (p.team = p.id === a.sessionId ? 0 : 1));
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await barrier(room, b);
    expect(room.state.phase).toBe('waiting');
  });

  it('transfers host to the next connected human, never a bot, and cancels a countdown on departure', async () => {
    const { room, clients } = await table({ maxPlayers: 3, lifecycleTiming: SLOW });
    const [a, b] = clients as [Room<GameState>, Room<GameState>];
    a.send('addBot', { difficulty: 'easy' });
    await vi.waitFor(() => expect(room.state.players.size).toBe(3));
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(room.state.phase).toBe('countdown'));
    await a.leave(true);
    await vi.waitFor(() => expect(room.state.players.has(a.sessionId)).toBe(false));
    expect(room.state.hostId).toBe(b.sessionId);
    expect(room.state.phase).toBe('waiting');
    expect(room.state.players.get(b.sessionId)!.isReady).toBe(false);
  });

  it('admits late spectators without gameplay or readiness controls', async () => {
    const { room, clients } = await table({ lifecycleTiming: SLOW });
    const [a] = clients as [Room<GameState>];
    const watcher = await server.connectTo(room, { spectator: true });
    watcher.onMessage('*', () => {});
    watcher.send('toggleReady', { isReady: true });
    watcher.send('addBot', { difficulty: 'easy' });
    await barrier(room, watcher);
    expect(room.state.players.has(watcher.sessionId)).toBe(false);
    expect(room.state.players.size).toBe(2);
    expect(room.state.spectatorCount).toBe(1);
    a.send('startGame'); // private tables do not start manually
    await barrier(room, a);
    expect(room.state.phase).toBe('waiting');
  });
});

describe('invitations and seat requests over the network', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (s: any) => s.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2584,
    );
  });
  afterEach(async () => server.cleanup());
  afterAll(async () => server.shutdown());

  async function watch(room: { roomId: string } & Record<string, any>) {
    const watcher = await server.connectTo(room as any, { spectator: true });
    watcher.onMessage('*', () => {});
    return watcher as Room<GameState>;
  }

  async function barrier(room: { waitForMessage(t: string): Promise<unknown> }, c: Room) {
    const seen = room.waitForMessage('ping');
    c.send('ping', { clientTime: Date.now() });
    await seen;
  }

  it('previews an invitation as a watcher, then seats the guest at once when a seat is free', async () => {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: FAST,
    });
    const host = await server.connectTo(room, { username: 'Host' });
    host.onMessage('*', () => {});
    const guest = await watch(room);
    // The preview shows the format, occupants and phase before taking a seat.
    await vi.waitFor(() => expect(guest.state.players.size).toBe(1));
    expect(guest.state.maxPlayers).toBe(2);
    expect(guest.state.phase).toBe('waiting');
    expect(guest.state.players.get(host.sessionId)?.username).toBe('Host');

    const seated = guest.waitForMessage('seated');
    guest.send('requestSeat', { username: 'Guest', avatarPreset: 'sage' });
    await seated;
    const player = room.state.players.get(guest.sessionId)!;
    expect(player.username).toBe('Guest');
    expect(player.avatarPreset).toBe('sage');
    expect(room.state.spectatorCount).toBe(0);
    expect(room.state.seatRequests.length).toBe(0);

    host.send('toggleReady', { isReady: true });
    guest.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(guest.state.phase).toBe('playing'));
    // A promoted watcher receives only their own hand.
    expect(guest.state.players.get(guest.sessionId)?.hand.length).toBe(5);
    expect(Array.from(guest.state.players.get(host.sessionId)?.hand ?? [])).toHaveLength(0);
  });

  it('queues late arrivals in order, never displacing a seated player, and seats them as seats open', async () => {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: FAST,
    });
    const a = await server.connectTo(room, { username: 'A' });
    const b = await server.connectTo(room, { username: 'B' });
    for (const c of [a, b]) c.onMessage('*', () => {});
    a.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(room.state.phase).toBe('playing'));

    const first = await watch(room);
    const second = await watch(room);
    first.send('requestSeat', { username: 'First' });
    await barrier(room, first);
    second.send('requestSeat', { username: 'Second' });
    await barrier(room, second);
    expect(room.state.seatRequests.map((r) => r.name)).toEqual(['First', 'Second']);
    // Waiting watchers still cannot play or read hands.
    first.send('attack', { cards: [{ suit: 'Hearts', rank: 7, isJoker: false }] });
    await barrier(room, first);
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(Array.from(first.state.players.get(a.sessionId)?.hand ?? [])).toHaveLength(0);
    // Direct joins cannot skip the line.
    await expect(server.connectTo(room, { username: 'Skipper' })).rejects.toThrow();

    // Game ends with a full table: everyone keeps their seat and the line waits.
    room.state.deck.splice(0, room.state.deck.length);
    room.state.players.get(a.sessionId)!.hand.splice(0);
    (room as any).checkGameOver();
    await vi.waitFor(() => expect(first.state.phase).toBe('finished'));
    expect(room.state.players.size).toBe(2);
    expect(room.state.seatRequests.length).toBe(2);

    // A seat opens: the first in line takes it; the second keeps waiting.
    await b.leave(true);
    await vi.waitFor(() => expect(room.state.players.has(first.sessionId)).toBe(true));
    expect(room.state.players.has(second.sessionId)).toBe(false);
    expect(room.state.seatRequests.map((r) => r.name)).toEqual(['Second']);
    expect(room.state.seatOrder.includes(first.sessionId)).toBe(true);

    // Leaving the line removes the request.
    await second.leave(true);
    await vi.waitFor(() => expect(room.state.seatRequests.length).toBe(0));
  });

  it('seats several waiting watchers when the host adds seats, without exceeding capacity', async () => {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: SLOW,
    });
    const host = await server.connectTo(room, { username: 'Host' });
    const other = await server.connectTo(room, { username: 'Other' });
    for (const c of [host, other]) c.onMessage('*', () => {});
    const watchers = [await watch(room), await watch(room), await watch(room)];
    for (const w of watchers) {
      w.send('requestSeat', { username: 'W' });
      await barrier(room, w);
    }
    expect(room.state.seatRequests.length).toBe(3);
    host.send('updateSettings', { maxPlayers: 4 });
    await vi.waitFor(() => expect(room.state.players.size).toBe(4));
    expect(room.state.seatRequests.length).toBe(1);
    expect(room.state.players.has(watchers[2]!.sessionId)).toBe(false);
  });
});

describe('private table lifecycle (room clock stubbed)', () => {
  function setup(options: Record<string, unknown>, ids: string[], bots: string[] = []) {
    const room = new DurakRoom();
    const handlers = new Map<string, (...args: any[]) => void>();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
    vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'onMessage').mockImplementation(((type: string, cb: any) => {
      handlers.set(type, cb);
      return () => {};
    }) as any);
    room.broadcast = vi.fn();
    room.onCreate({ isPrivate: true, ...options });
    ids.forEach((id, i) => {
      const p = new Player(id);
      p.team = i % 2;
      if (bots.includes(id)) {
        p.control = 'bot';
        p.isReady = true;
        (room as any).botIds.set(id, 'easy');
      }
      room.state.players.set(id, p);
    });
    room.state.hostId = ids[0]!;
    const timers: Array<{ fn: () => void; cleared: boolean }> = [];
    vi.spyOn(room.clock, 'setTimeout').mockImplementation(((fn: () => void) => {
      const timer = { fn, cleared: false };
      timers.push(timer);
      return { clear: () => (timer.cleared = true) };
    }) as any);
    vi.spyOn(room as any, 'startTurnTimer').mockImplementation(() => {});
    vi.spyOn(room as any, 'scheduleBotTurn').mockImplementation(() => {});
    const client = (id: string) => ({ sessionId: id, send: vi.fn() });
    const send = (id: string, type: string, message?: unknown) =>
      handlers.get(type)!(client(id), message);
    const fireLatest = () => {
      const live = timers.filter((t) => !t.cleared);
      live[live.length - 1]!.fn();
    };
    return { room, send, fireLatest, timers };
  }

  afterEach(() => vi.restoreAllMocks());

  it('never launches a bot-only table', () => {
    const { room } = setup({ maxPlayers: 2 }, ['b1', 'b2'], ['b1', 'b2']);
    (room as any).evaluateCountdown();
    expect(room.state.phase).toBe('waiting');
  });

  it('keeps Horse letters between sub-games and resets them for a new match', () => {
    const { room, send, fireLatest } = setup(
      { mode: 'horse', maxPlayers: 4 },
      ['h0', 'b1', 'h2', 'b3'],
      ['b1', 'b3'],
    );
    const readyAll = () => {
      send('h0', 'toggleReady', { isReady: true });
      send('h2', 'toggleReady', { isReady: true });
    };
    readyAll();
    expect(room.state.phase).toBe('countdown');
    fireLatest();
    expect(room.state.phase).toBe('opening');
    expect(room.state.horseGame).toBe(1);

    room.state.phase = 'playing';
    (room as any).handleHorseRoundEnd(0);
    (room as any).finishPrivateGame();
    room.state.phase = 'finished';
    expect(room.state.horseTeamA).toBe('H');
    // No timed return to the lobby on private tables.
    readyAll();
    fireLatest();
    expect(room.state.horseTeamA).toBe('H');
    expect(room.state.horseGame).toBe(2);

    room.state.horseTeamA = 'HORS';
    room.state.phase = 'playing';
    (room as any).handleHorseRoundEnd(0);
    (room as any).finishPrivateGame();
    room.state.phase = 'finished';
    expect(room.state.horseTeamA).toBe('HORSE');
    readyAll();
    fireLatest();
    expect(room.state.horseTeamA).toBe('');
    expect(room.state.horseTeamB).toBe('');
    expect(room.state.horseGame).toBe(1);
  });

  it('hands the first turn to the next seat when the first player leaves during the opening', () => {
    const { room, fireLatest } = setup({ maxPlayers: 3 }, ['p0', 'p1', 'p2']);
    (room as any).startGame({ opening: true });
    expect(room.state.phase).toBe('opening');
    const first = room.state.currentTurn;
    const order = Array.from(room.state.seatOrder);
    const expected = order[(order.indexOf(first) + 1) % order.length];
    (room as any).permanentlyRemovePlayer(first, true);
    expect(room.state.currentTurn).toBe(expected);
    expect(room.state.turnStartTime).toBe(0);
    fireLatest();
    expect(room.state.phase).toBe('playing');
    expect(room.state.turnStartTime).toBeGreaterThan(0);
  });

  it('a stale countdown cannot deal once the table changed', () => {
    const { room, send, timers } = setup({ maxPlayers: 2 }, ['p0', 'p1']);
    send('p0', 'toggleReady', { isReady: true });
    send('p1', 'toggleReady', { isReady: true });
    const countdown = timers[timers.length - 1]!;
    send('p1', 'toggleReady', { isReady: false });
    expect(countdown.cleared).toBe(true);
    countdown.fn(); // even if a cleared timer fired
    expect(room.state.phase).toBe('waiting');
    expect(room.state.players.get('p0')!.hand.length).toBe(0);
  });

  it('only the host edits seats, and only permanent bots are removable', () => {
    const { room, send } = setup({ maxPlayers: 3 }, ['p0', 'p1']);
    send('p1', 'addBot', { difficulty: 'easy' });
    expect(room.state.players.size).toBe(2);
    send('p0', 'addBot', { difficulty: 'nightmare' });
    expect(room.state.players.size).toBe(2);
    send('p0', 'addBot', { difficulty: 'easy' });
    const bot = Array.from(room.state.players.values()).find((p) => p.control === 'bot')!;
    bot.control = 'standin';
    send('p0', 'removeBot', { playerId: bot.id });
    expect(room.state.players.has(bot.id)).toBe(true);
    room.state.phase = 'playing';
    bot.control = 'bot';
    send('p0', 'removeBot', { playerId: bot.id });
    expect(room.state.players.has(bot.id)).toBe(true);
  });
});
