import { afterEach, describe, expect, it, vi } from 'vitest';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { Card, Player } from '@durak/shared';

function createRoom(environment: string, options: Record<string, unknown> = {}) {
  vi.stubEnv('NODE_ENV', environment);
  const room = new DurakRoom();
  const handlers = new Map<string, (...args: any[]) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'onMessage').mockImplementation(((
    type: string,
    callback: (...args: any[]) => void,
  ) => {
    handlers.set(type, callback);
    return () => handlers.delete(type);
  }) as any);
  room.broadcast = vi.fn();
  room.onCreate(options);
  room.state.hostId = 'host';
  room.state.players.set('host', new Player('host'));
  return { room, send: handlers.get('dev_action')! };
}

const host = { sessionId: 'host', send: vi.fn() };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('production room debug guards', () => {
  it.each(['force_pass', 'play_as'])('rejects host debug action %s in production', (action) => {
    const { room, send } = createRoom('production');
    const pass = vi.spyOn(room as any, 'nextTurn').mockImplementation(() => {});
    const attack = vi.spyOn(room as any, 'handleAttack').mockImplementation(() => {});
    send(host, { action, type: 'attack', asPlayerId: 'victim', cards: [] });
    expect(pass).not.toHaveBeenCalled();
    expect(attack).not.toHaveBeenCalled();
  });

  it.each(['easy', 'hard'])(
    'keeps supported %s bot creation available to the host',
    (difficulty) => {
      const { room, send } = createRoom('production', { maxPlayers: 2 });
      send(host, { action: 'spawn_dummies', difficulty, count: 1 });
      expect(room.state.players.size).toBe(2);
      expect(
        Array.from(room.state.players.values()).some(
          (p) => p.control === 'bot' && p.username === 'Orgil',
        ),
      ).toBe(true);
    },
  );

  it.each(['dummy', 'unknown', undefined])(
    'rejects unsupported production bot type %s',
    (difficulty) => {
      const { room, send } = createRoom('production');
      send(host, { action: 'spawn_dummies', difficulty });
      expect(room.state.players.size).toBe(1);
    },
  );

  it('rejects non-host bot creation', () => {
    const { room, send } = createRoom('production');
    send({ sessionId: 'guest' }, { action: 'spawn_dummies', difficulty: 'easy' });
    expect(room.state.players.size).toBe(1);
  });

  it.each(['playing', 'finished'])('does not add bots to a %s game', (phase) => {
    const { room, send } = createRoom('production');
    room.state.phase = phase;
    send(host, { action: 'spawn_dummies', difficulty: 'easy' });
    expect(room.state.players.size).toBe(1);
  });

  it('ignores malformed debug payloads', () => {
    const { room, send } = createRoom('production');
    expect(() => send(host, null)).not.toThrow();
    expect(() => send(host, undefined)).not.toThrow();
    expect(room.state.players.size).toBe(1);
  });

  it('preserves local developer controls', () => {
    const { room, send } = createRoom('development');
    const pass = vi.spyOn(room as any, 'nextTurn').mockImplementation(() => {});
    send(host, { action: 'force_pass' });
    expect(pass).toHaveBeenCalledOnce();
  });

  it.each(['production', 'development'])('ignores client deck fixtures in %s', (environment) => {
    const { room } = createRoom(environment, { testModeDeck: [new Card('Hearts', 7)] });
    expect((room as any).testModeDeck).toBeUndefined();
  });

  it('preserves deterministic deck fixtures for tests', () => {
    const deck = [new Card('Hearts', 7)];
    const { room } = createRoom('test', { testModeDeck: deck });
    expect((room as any).testModeDeck).toBe(deck);
  });

  it.each([
    { botDifficulty: 'medium' },
    { botDifficulty: 'easy', isPrivate: false },
    { botDifficulty: 'hard', maxPlayers: 4 },
    { botDifficulty: 'easy', handSize: 6 },
    { botDifficulty: 'easy', mode: 'teams' },
  ])('rejects unsupported solo configuration %j', (invalid) => {
    expect(() =>
      createRoom('production', {
        isPrivate: true,
        maxPlayers: 2,
        mode: 'classic',
        handSize: 5,
        ...invalid,
      }),
    ).toThrow(/Solo requires|Hand size|Teams and Horse/);
  });
});
