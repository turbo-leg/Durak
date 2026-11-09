import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTrafficProtection } from '../src/operations/traffic';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function ingress(options: Parameters<typeof createTrafficProtection>[0] = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(createTrafficProtection(options));
  app.use((_req, res) => res.json({ accepted: true }));
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (path: string, ip = '192.0.2.1', method = 'POST') =>
    fetch(url + path, { method, headers: { 'X-Forwarded-For': ip } });
}

describe('HTTP ingress traffic protection', () => {
  it('throttles repeated auth work across auth endpoints and gives a retry deadline', async () => {
    const request = await ingress({ authPerMinute: 2 });
    expect((await request('/api/auth/login')).status).toBe(200);
    expect((await request('/api/auth/discord/session')).status).toBe(200);
    const rejected = await request('/api/token');
    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await rejected.json()).toMatchObject({ code: 429 });
    expect((await request('/api/auth/login', '192.0.2.2')).status).toBe(200);
  });

  it('applies a separate registration budget without blocking permitted logins', async () => {
    const request = await ingress({ registrationsPerQuarterHour: 1 });
    expect((await request('/api/auth/register')).status).toBe(200);
    expect((await request('/api/auth/register')).status).toBe(429);
    expect((await request('/api/auth/login')).status).toBe(200);
  });

  it('keeps Express case and trailing-slash aliases in the same endpoint budgets', async () => {
    const registration = await ingress({ registrationsPerQuarterHour: 1 });
    expect((await registration('/api/auth/register')).status).toBe(200);
    expect((await registration('/API/AUTH/REGISTER/')).status).toBe(429);
    const token = await ingress({ authPerMinute: 1 });
    expect((await token('/api/token/')).status).toBe(200);
    expect((await token('/api/token')).status).toBe(429);
  });

  it('limits both create and joinOrCreate before matchmaking handles them', async () => {
    const request = await ingress({ roomCreationsPerMinute: 2 });
    expect((await request('/matchmake/create/durak')).status).toBe(200);
    expect((await request('/matchmake/joinOrCreate/durak')).status).toBe(200);
    expect((await request('/matchmake/create/durak')).status).toBe(429);
    expect((await request('/matchmake/joinById/room')).status).toBe(200);
  });

  it('also bounds repeated join and reconnect reservations', async () => {
    const request = await ingress({ matchmakingPerMinute: 2 });
    expect((await request('/matchmake/joinById/room')).status).toBe(200);
    expect((await request('/matchmake/reconnect/room')).status).toBe(200);
    expect((await request('/matchmake/joinById/room')).status).toBe(429);
  });

  it('does not spend auth budgets on health, assets, or ordinary GET requests', async () => {
    const request = await ingress({ authPerMinute: 1 });
    expect((await request('/health', undefined, 'GET')).status).toBe(200);
    expect((await request('/cards/card.webp', undefined, 'GET')).status).toBe(200);
    expect((await request('/api/auth/login', undefined, 'GET')).status).toBe(200);
    expect((await request('/api/auth/login')).status).toBe(200);
  });

  it('recovers after a rate-limit window expires', async () => {
    let now = 0;
    const request = await ingress({ authPerMinute: 1, now: () => now });
    expect((await request('/api/token')).status).toBe(200);
    expect((await request('/api/token')).status).toBe(429);
    now = 60_000;
    expect((await request('/api/token')).status).toBe(200);
  });

  it('bounds tracking memory and reclaims expired keys rather than evicting active budgets', async () => {
    let now = 0;
    const request = await ingress({ maxKeys: 1, now: () => now });
    expect((await request('/api/token', '192.0.2.1')).status).toBe(200);
    expect((await request('/api/token', '192.0.2.2')).status).toBe(503);
    now = 60_000;
    expect((await request('/api/token', '192.0.2.2')).status).toBe(200);
  });
});
