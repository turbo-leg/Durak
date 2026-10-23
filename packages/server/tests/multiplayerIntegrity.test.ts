import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import jwt from 'jsonwebtoken';
import { Card, DurakEngine, GameState, Rank, Suit } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { sessionSecret, verifyRoomIdentity } from '../src/auth/session';

const USER_A = '0123456789abcdef01234567';
const USER_B = 'abcdef0123456789abcdef01';
const SECRET = 'test-only-session-key-for-integrity';
const token = (claims: object, expiresIn = 300) => jwt.sign(claims, SECRET, { expiresIn });

describe('verified room identity', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('permits an explicit guest without granting a persistent identity', () => {
    expect(verifyRoomIdentity({})).toEqual({ userId: '', discordId: '' });
  });

  it.each([{ userId: USER_A }, { discordId: '123456789012345678' }])(
    'rejects unsigned claims %j',
    (claims) => {
      expect(() => verifyRoomIdentity(claims)).toThrow(/Sign in again/);
    },
  );

  it('derives email and Discord identities only from signed claims', () => {
    vi.stubEnv('JWT_SECRET', SECRET);
    expect(verifyRoomIdentity({ token: token({ userId: USER_A }) })).toEqual({
      userId: USER_A,
      discordId: '',
    });
    expect(verifyRoomIdentity({ token: token({ discordId: '123456789012345678' }) })).toEqual({
      userId: '',
      discordId: '123456789012345678',
    });
  });

  it('rejects impersonation even with a valid token for a different account', () => {
    vi.stubEnv('JWT_SECRET', SECRET);
    expect(() => verifyRoomIdentity({ token: token({ userId: USER_A }), userId: USER_B })).toThrow(
      /does not match/,
    );
  });

  it.each([
    () => token({ userId: USER_A }, -1),
    () => jwt.sign({ userId: USER_A }, 'wrong-key', { expiresIn: 300 }),
    () => jwt.sign({ userId: USER_A }, SECRET),
    () => token({ userId: USER_A, discordId: '123' }),
    () => token({ userId: { $ne: '' } }),
    () => token({}),
    () => 'not-a-token',
  ])('rejects expired, forged or malformed session credentials %#', (credential) => {
    vi.stubEnv('JWT_SECRET', SECRET);
    expect(() => verifyRoomIdentity({ token: credential() })).toThrow();
  });

  it('does not fall back to a development secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'secret');
    expect(() => sessionSecret()).toThrow(/production/);
  });
});

describe('multiplayer network privacy and authentication', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (gameServer: any) => gameServer.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2578,
    );
  });
  afterEach(async () => {
    await server.cleanup();
    vi.unstubAllEnvs();
  });
  afterAll(async () => server?.shutdown());

  async function controlledGame() {
    const room = await server.createRoom<GameState>('durak', {
      isPrivate: true,
      maxPlayers: 2,
      lifecycleTiming: { countdownMs: 50, openingMs: 50 },
    });
    const a = await server.connectTo(room);
    const b = await server.connectTo(room);
    a.onMessage('*', () => {});
    b.onMessage('*', () => {});
    room.state.deck.push(...DurakEngine.createDeck());
    const take = (suit: string, rank: number) => {
      const index = room.state.deck.findIndex((card) => card.suit === suit && card.rank === rank);
      const card = room.state.deck.splice(index, 1)[0];
      if (!card) throw new Error('Missing fixture card');
      return new Card(card.suit, card.rank, card.isJoker);
    };
    room.state.huzurSuit = Suit.Spades;
    room.state.huzurCard = new Card(Suit.Spades, Rank.Eight);
    // Pin the visible Huzur at the actual bottom, preserving all 42 cards.
    const bottom = take(Suit.Spades, Rank.Eight);
    const remaining = Array.from(room.state.deck).filter((c): c is Card => !!c);
    room.state.deck.clear();
    room.state.deck.push(bottom, ...remaining);
    const pa = room.state.players.get(a.sessionId)!;
    const pb = room.state.players.get(b.sessionId)!;
    pa.hand.push(take(Suit.Spades, Rank.Seven), take(Suit.Hearts, Rank.Seven));
    pb.hand.push(take(Suit.Clubs, Rank.Seven), take(Suit.Hearts, Rank.Eight));
    pa.lastDrawLog.push('PRIVATE_DRAW_A');
    pb.lastDrawLog.push('PRIVATE_DRAW_B');
    pb.pickedUpCardKeys.push('PRIVATE_PROVENANCE_B');
    room.state.actionLog.push('PRIVATE_REPLAY_CANARY');
    room.state.phase = 'playing';
    room.state.seatOrder.push(a.sessionId, b.sessionId);
    room.state.currentTurn = a.sessionId;
    await vi.waitFor(() => expect(a.state?.deckCount).toBe(38));
    const spectator = await server.connectTo(room, { spectator: true });
    spectator.onMessage('*', () => {});
    await vi.waitFor(() => expect(spectator.state?.deckCount).toBe(38));
    return { room, a, b, spectator };
  }

  function assertPrivate(view: Room<GameState>, ownerId?: string) {
    expect(Array.from(view.state.deck ?? [])).toHaveLength(0);
    expect(Array.from(view.state.actionLog ?? [])).toHaveLength(0);
    expect(JSON.stringify(view.state.toJSON())).not.toContain('PRIVATE_REPLAY_CANARY');
    view.state.players.forEach((p) => {
      if (p.id !== ownerId) {
        expect(Array.from(p.hand ?? [])).toHaveLength(0);
        expect(Array.from(p.lastDrawLog ?? [])).toHaveLength(0);
        expect(Array.from(p.pickedUpCardKeys ?? [])).toHaveLength(0);
      }
    });
  }

  it('filters initial snapshots and incremental draws, swaps and pickup for players and spectators', async () => {
    const { room, a, b, spectator } = await controlledGame();
    for (const [view, owner] of [
      [a, a.sessionId],
      [b, b.sessionId],
      [spectator, undefined],
    ] as const) {
      assertPrivate(view, owner);
      expect(view.state.players.get(a.sessionId)?.handCount).toBe(2);
      expect(view.state.players.get(b.sessionId)?.handCount).toBe(2);
    }
    expect(a.state.players.get(a.sessionId)?.hand.length).toBe(2);
    expect(b.state.players.get(b.sessionId)?.lastDrawLog[0]).toBe('PRIVATE_DRAW_B');

    a.send('swapHuzur');
    await vi.waitFor(() => expect(a.state.huzurCard.rank).toBe(Rank.Seven));
    expect(
      a.state.players
        .get(a.sessionId)
        ?.hand.some((c) => c.suit === Suit.Spades && c.rank === Rank.Eight),
    ).toBe(true);
    a.send('attack', { cards: [{ suit: Suit.Hearts, rank: Rank.Seven, isJoker: false }] });
    await vi.waitFor(() => expect(b.state.activeAttackCards.length).toBe(1));
    b.send('pickUp');
    await vi.waitFor(() => expect(b.state.activeAttackCards.length).toBe(0));
    await vi.waitFor(() => expect(spectator.state.deckCount).toBe(room.state.deck.length));
    for (const [view, owner] of [
      [a, a.sessionId],
      [b, b.sessionId],
      [spectator, undefined],
    ] as const) {
      assertPrivate(view, owner);
      room.state.players.forEach((p) =>
        expect(view.state.players.get(p.id)?.handCount).toBe(p.hand.length),
      );
    }
    expect(a.state.players.get(a.sessionId)?.hand.length).toBe(5);
    // Both players refill after attack; the defender then picks up the attack.
    expect(b.state.players.get(b.sessionId)?.hand.length).toBe(6);
  });

  it('restores only the owner hand on reconnect and keeps next-game deals private', async () => {
    const { room, a, b, spectator } = await controlledGame();
    const reconnectToken = a.reconnectionToken;
    a.connection.close();
    await vi.waitFor(() =>
      expect(room.clients.some((c) => c.sessionId === a.sessionId)).toBe(false),
    );
    const restored = await server.sdk.reconnect<GameState>(reconnectToken);
    restored.onMessage('*', () => {});
    await vi.waitFor(() =>
      expect(restored.state?.players.get(restored.sessionId)?.hand.length).toBe(2),
    );
    assertPrivate(restored, restored.sessionId);
    room.state.phase = 'finished';
    await vi.waitFor(() => expect(b.state.phase).toBe('finished'));
    // Private tables ready up for the next game instead of voting for a rematch.
    restored.send('toggleReady', { isReady: true });
    b.send('toggleReady', { isReady: true });
    await vi.waitFor(() => expect(b.state.phase).toBe('playing'));
    await vi.waitFor(() =>
      expect(restored.state.players.get(restored.sessionId)?.hand.length).toBe(5),
    );
    await vi.waitFor(() => expect(spectator.state.deckCount).toBe(32));
    assertPrivate(restored, restored.sessionId);
    assertPrivate(b, b.sessionId);
    assertPrivate(spectator);
  });

  it('rejects forged joins and assigns canonical signed identities through real matchmaking', async () => {
    vi.stubEnv('JWT_SECRET', SECRET);
    const room = await server.createRoom<GameState>('durak', { isPrivate: true, maxPlayers: 4 });
    const guest = await server.connectTo(room);
    await expect(server.connectTo(room, { userId: USER_A })).rejects.toThrow(/Sign in again/);
    await expect(
      server.connectTo(room, { token: token({ userId: USER_A }), userId: USER_B }),
    ).rejects.toThrow(/does not match/);
    const a = await server.connectTo(room, { token: token({ userId: USER_A }) });
    expect(room.state.players.get(a.sessionId)?.userId).toBe(USER_A);
    await expect(server.connectTo(room, { token: token({ userId: USER_A }) })).rejects.toThrow(
      /already seated/,
    );
    expect(room.state.players.get(guest.sessionId)?.userId).toBe('');
  });

  it('ignores malformed traffic while keeping the connection and authoritative state usable', async () => {
    const { room, a } = await controlledGame();
    for (const [type, payload] of [
      ['attack', null],
      ['defend', null],
      ['ping', null],
      ['defendStage', null],
      ['defendUnstage', false],
      ['switchTeam', null],
      ['rematchVote', null],
      ['toggleReady', null],
    ] as const)
      a.send(type, payload);
    const pong = a.waitForMessage('pong');
    a.send('ping', { clientTime: 123 });
    expect(await pong).toMatchObject({ clientTime: 123 });
    expect(room.state.currentTurn).toBe(a.sessionId);
    expect(room.state.activeAttackCards.length).toBe(0);
    expect(room.state.players.get(a.sessionId)?.hand.length).toBe(2);
  });
});
