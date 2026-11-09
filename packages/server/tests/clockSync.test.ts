import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DurakRoom } from '../src/rooms/DurakRoom';
import { wireTimestamp } from '../src/utils/wireTimestamp';

describe('wire timestamps', () => {
  it('normalizes uint64 epochs without accepting unsafe or malformed values', () => {
    const epoch = 1_793_001_473_670;
    expect(wireTimestamp(BigInt(epoch))).toBe(epoch);
    expect(wireTimestamp(epoch)).toBe(epoch);
    expect(wireTimestamp(12.5)).toBe(12.5);
    for (const invalid of [-1, -1n, NaN, Infinity, '123', null, {}, 9007199254740992n]) {
      expect(wireTimestamp(invalid)).toBeNull();
    }
  });
});

describe('clock synchronization over the real Colyseus wire', () => {
  let server: ColyseusTestServer;
  beforeAll(async () => {
    server = await boot(
      {
        initializeGameServer: (s) => s.define('durak', DurakRoom),
        initializeExpress: () => {},
      },
      2595,
    );
  });
  afterEach(async () => server.cleanup());
  afterAll(async () => server.shutdown());

  it('returns the exact epoch and a numeric server timestamp to a skewed client', async () => {
    const room = await server.createRoom('durak', { isPrivate: true, maxPlayers: 2 });
    const client = await server.connectTo(room);
    const before = Date.now();
    const skewedClientTime = before + 5 * 60_000;
    const pong = new Promise<{ clientTime: number; serverTime: number }>((resolve) => {
      client.onMessage('pong', resolve);
    });
    client.send('ping', { clientTime: skewedClientTime });
    const response = await pong;
    expect(response.clientTime).toBe(skewedClientTime);
    expect(typeof response.serverTime).toBe('number');
    expect(response.serverTime).toBeGreaterThanOrEqual(before);
    expect(response.serverTime).toBeLessThanOrEqual(Date.now());
    const skewedNow = Date.now() + 5 * 60_000;
    const offset = response.serverTime - (response.clientTime + (skewedNow - skewedClientTime) / 2);
    expect(offset).toBeLessThan(-299_000);
    expect(offset).toBeGreaterThan(-301_000);
  });
});
