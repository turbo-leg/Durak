import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from 'colyseus.js';
import { Card, GameState, LOOK_YAW_LIMIT, LOOK_PITCH_MIN } from '@durak/shared';
import { DurakRoom } from '../src/rooms/DurakRoom';

describe('avatar presence over the real room connection', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (s: any) => s.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2581,
    );
  });
  afterEach(async () => server.cleanup());
  afterAll(async () => server.shutdown());
  async function fixture() {
    const room = await server.createRoom<GameState>('durak', { isPrivate: true, maxPlayers: 2 });
    const a = await server.connectTo(room, { avatarPreset: 'indigo' });
    const b = await server.connectTo(room, { avatarPreset: 'not-a-preset' });
    for (const client of [a, b]) client.onMessage('*', () => {});
    return { room, a, b };
  }
  async function barrier(
    room: { waitForMessage(type: string): Promise<unknown> },
    client: Room<GameState>,
  ) {
    const received = room.waitForMessage('ping');
    client.send('ping', { clientTime: Date.now() });
    await received;
  }
  it('shares valid presets, validates lobby changes, and rejects appearance changes during play', async () => {
    const { room, a, b } = await fixture();
    expect(room.state.players.get(a.sessionId)!.avatarPreset).toBe('indigo');
    expect(room.state.players.get(b.sessionId)!.avatarPreset).toBe('copper');
    a.send('avatarPreset', { preset: 'sage' });
    await vi.waitFor(() => expect(b.state.players.get(a.sessionId)?.avatarPreset).toBe('sage'));
    a.send('avatarPreset', { preset: '../../anything' });
    await barrier(room, a);
    expect(room.state.players.get(a.sessionId)!.avatarPreset).toBe('sage');
    room.state.phase = 'playing';
    a.send('avatarPreset', { preset: 'ochre' });
    await barrier(room, a);
    expect(room.state.players.get(a.sessionId)!.avatarPreset).toBe('sage');
  });
  it('clamps gaze, derives identity from the sender, and keeps private cards filtered', async () => {
    const { room, a, b } = await fixture();
    room.state.phase = 'playing';
    const spectator = await server.connectTo(room, { spectator: true });
    spectator.onMessage('*', () => {});
    room.state.players.get(a.sessionId)!.hand.push(new Card('Hearts', 16));
    a.send('look', { sessionId: b.sessionId, yaw: 100, pitch: -100 });
    await vi.waitFor(() =>
      expect(b.state.players.get(a.sessionId)?.headYaw).toBeCloseTo(LOOK_YAW_LIMIT),
    );
    expect(b.state.players.get(a.sessionId)?.headPitch).toBeCloseTo(LOOK_PITCH_MIN);
    expect(room.state.players.get(b.sessionId)!.headYaw).toBe(0);
    expect(Array.from(b.state.players.get(a.sessionId)?.hand ?? [])).toHaveLength(0);
    expect(Array.from(spectator.state.players.get(a.sessionId)?.hand ?? [])).toHaveLength(0);
    spectator.send('look', { sessionId: a.sessionId, yaw: 0, pitch: 0 });
    spectator.send('avatarPreset', { preset: 'ochre' });
    await barrier(room, spectator);
    expect(room.state.players.size).toBe(2);
    expect(room.state.players.get(a.sessionId)!.headYaw).toBeCloseTo(LOOK_YAW_LIMIT);
  });
  it('rejects malformed and excess look messages without exhausting gameplay messages', async () => {
    const { room, a } = await fixture();
    a.send('look', { yaw: 'left', pitch: 0 });
    a.send('look', { yaw: 0.2, pitch: 0.1 });
    for (let i = 0; i < 30; i++) a.send('look', { yaw: 0.8, pitch: 0.2 });
    a.send('toggleReady', { isReady: false });
    await barrier(room, a);
    expect(room.state.players.get(a.sessionId)!.headYaw).toBeCloseTo(0.2);
    expect(room.state.players.get(a.sessionId)!.isReady).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 120));
    a.send('look', { yaw: -0.3, pitch: 0 });
    await vi.waitFor(() => expect(room.state.players.get(a.sessionId)!.headYaw).toBeCloseTo(-0.3));
  });
  it('increments play animation state only after the server accepts a play', async () => {
    const { room, a, b } = await fixture();
    room.state.deck.push(new Card('Clubs', 10), new Card('Spades', 9));
    room.state.players.get(a.sessionId)!.hand.push(new Card('Hearts', 7));
    room.state.players.get(b.sessionId)!.hand.push(new Card('Hearts', 8));
    room.state.seatOrder.push(a.sessionId, b.sessionId);
    room.state.phase = 'playing';
    room.state.currentTurn = a.sessionId;
    a.send('attack', { cards: [{ suit: 'Clubs', rank: 16, isJoker: false }] });
    await barrier(room, a);
    expect(room.state.players.get(a.sessionId)!.playSequence).toBe(0);
    a.send('attack', { cards: [{ suit: 'Hearts', rank: 7, isJoker: false }] });
    await vi.waitFor(() => expect(b.state.players.get(a.sessionId)?.playSequence).toBe(1));
    b.send('defend', { cards: [{ suit: 'Hearts', rank: 8, isJoker: false }] });
    await vi.waitFor(() => expect(a.state.players.get(b.sessionId)?.playSequence).toBe(1));
  });
  it('broadcasts the ground card and its updates to both players and spectators', async () => {
    const { room, a, b } = await fixture();
    room.state.phase = 'playing';
    room.state.huzurCard = new Card('Hearts', 13);
    room.state.huzurSuit = 'Hearts';
    const spectator = await server.connectTo(room, { spectator: true });
    spectator.onMessage('*', () => {});
    for (const client of [a, b, spectator]) {
      await vi.waitFor(() => expect(client.state.huzurCard.rank).toBe(13));
      expect(client.state.huzurCard.suit).toBe('Hearts');
    }
    room.state.huzurCard.rank = 7;
    for (const client of [a, b, spectator])
      await vi.waitFor(() => expect(client.state.huzurCard.rank).toBe(7));
  });

  it('broadcasts sender-owned public gestures, rejects invalid IDs and spectator control, and expires poses', async () => {
    const { room, a, b } = await fixture();
    room.state.phase = 'playing';
    const spectator = await server.connectTo(room, { spectator: true });
    spectator.onMessage('*', () => {});
    a.send('gesture', { id: 'unknown' });
    a.send('gesture', { id: 'nose', sessionId: b.sessionId, gestureStartedAt: 1 });
    await vi.waitFor(() => expect(b.state.players.get(a.sessionId)?.gestureId).toBe('nose'));
    const player = room.state.players.get(a.sessionId)!;
    expect(player.gestureStartedAt).toBeGreaterThan(Date.now() - 1000);
    expect(player.gestureSequence).toBe(1);
    expect(room.state.players.get(b.sessionId)!.gestureId).toBe('');
    await vi.waitFor(() =>
      expect(spectator.state.players.get(a.sessionId)?.gestureId).toBe('nose'),
    );
    for (let i = 0; i < 30; i++) a.send('gesture', { id: 'four' });
    spectator.send('gesture', { id: 'two', sessionId: a.sessionId });
    a.send('look', { yaw: 0.2, pitch: 0.1 });
    await barrier(room, a);
    await barrier(room, spectator);
    expect(player.gestureSequence).toBe(1);
    expect(player.gestureId).toBe('nose');
    expect(player.headYaw).toBeCloseTo(0.2);
    const late = await server.connectTo(room, { spectator: true });
    late.onMessage('*', () => {});
    await vi.waitFor(() => expect(late.state.players.get(a.sessionId)?.gestureSequence).toBe(1));
    expect(late.state.players.get(a.sessionId)?.gestureStartedAt).toBe(player.gestureStartedAt);
    await vi.waitFor(() => expect(b.state.players.get(a.sessionId)?.gestureId).toBe(''), {
      timeout: 3000,
    });
  });

  it('gives accepted plays priority over emotes, with no interruption for rejected plays', async () => {
    const { room, a } = await fixture();
    room.state.deck.push(new Card('Clubs', 10), new Card('Spades', 9));
    room.state.players.get(a.sessionId)!.hand.push(new Card('Hearts', 7));
    room.state.seatOrder.push(...room.state.players.keys());
    room.state.phase = 'playing';
    room.state.currentTurn = a.sessionId;
    a.send('gesture', { id: 'three' });
    await barrier(room, a);
    a.send('attack', { cards: [{ suit: 'Clubs', rank: 16, isJoker: false }] });
    await barrier(room, a);
    expect(room.state.players.get(a.sessionId)!.gestureId).toBe('three');
    a.send('attack', { cards: [{ suit: 'Hearts', rank: 7, isJoker: false }] });
    await vi.waitFor(() => expect(room.state.players.get(a.sessionId)!.playSequence).toBe(1));
    expect(room.state.players.get(a.sessionId)!.gestureId).toBe('');
  });
});
