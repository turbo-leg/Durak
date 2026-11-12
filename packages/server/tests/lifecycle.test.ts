import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { Room, Server } from 'colyseus';
import { Client } from 'colyseus.js';
import { Schema, type } from '@colyseus/schema';
import {
  createReadinessGate,
  drainActiveGames,
  protectServerRequests,
  ServerLifecycle,
} from '../src/operations/lifecycle';

class DrainProbeState extends Schema {
  @type('number') moves = 0;
}

class DrainProbeRoom extends Room<DrainProbeState> {
  onCreate() {
    this.setState(new DrainProbeState());
    this.onMessage('play', () => this.state.moves++);
  }
}

describe('dependency readiness and deployment drain', () => {
  it('fails readiness on database loss, pending results, or drain while liveness can stay up', () => {
    const lifecycle = new ServerLifecycle();
    let connected = false;
    let pending = 0;
    lifecycle.configure({
      databaseRequired: true,
      databaseConnected: () => connected,
      failedResults: () => pending,
    });
    expect(lifecycle.isReady).toBe(false);
    connected = true;
    expect(lifecycle.isReady).toBe(true);
    pending = 1;
    expect(lifecycle.readiness()).toMatchObject({ ready: false, pendingResults: 1 });
    pending = 0;
    expect(lifecycle.isReady).toBe(true);
    lifecycle.beginDrain();
    expect(lifecycle.readiness()).toMatchObject({ ready: false, draining: true });
  });

  it('keeps hosting games while the database is down when degraded mode is allowed', async () => {
    const lifecycle = new ServerLifecycle();
    let connected = false;
    let failed = 0;
    let queued = 0;
    lifecycle.configure({
      databaseRequired: true,
      databaseConnected: () => connected,
      failedResults: () => failed,
      queuedResults: () => queued,
      allowDegraded: true,
    });
    expect(lifecycle.readiness()).toMatchObject({
      ready: true,
      degraded: true,
      databaseReady: false,
    });
    // A long outage: results waiting for the database never close the server.
    failed = 900;
    queued = 900;
    expect(lifecycle.isReady).toBe(true);
    // Back online with a backlog still being written: open, but reported as degraded.
    connected = true;
    failed = 0;
    queued = 450;
    expect(lifecycle.readiness()).toMatchObject({
      ready: true,
      degraded: true,
      databaseReady: true,
      pendingResults: 450,
    });
    // Connected but rejecting writes: stop new games so failures cannot pile up.
    failed = 1;
    expect(lifecycle.readiness()).toMatchObject({ ready: false, failedResults: 1 });
    failed = 0;
    queued = 0;
    expect(lifecycle.readiness()).toMatchObject({ ready: true, degraded: false });
    lifecycle.beginDrain();
    expect(lifecycle.isReady).toBe(false);

    const app = express();
    connected = false;
    const open = new ServerLifecycle();
    open.configure({
      databaseRequired: true,
      databaseConnected: () => connected,
      allowDegraded: true,
    });
    app.use(createReadinessGate(open));
    app.use((_req, res) => res.json({ accepted: true }));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP listener');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      // Guest games still start; anything that needs an account waits for the database.
      expect((await fetch(`${url}/matchmake/joinOrCreate/durak`, { method: 'POST' })).status).toBe(
        200,
      );
      expect((await fetch(`${url}/api/auth/login`, { method: 'POST' })).status).toBe(503);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('blocks real matchmaking and database HTTP requests but preserves reconnect and health', async () => {
    const lifecycle = new ServerLifecycle();
    let connected = true;
    lifecycle.configure({ databaseRequired: true, databaseConnected: () => connected });
    const app = express();
    app.use(createReadinessGate(lifecycle));
    app.use((_req, res) => res.json({ accepted: true }));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP listener');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(`${url}/matchmake/create/durak`, { method: 'POST' })).status).toBe(200);
      connected = false;
      expect((await fetch(`${url}/api/auth/login`, { method: 'POST' })).status).toBe(503);
      expect((await fetch(`${url}/API/AUTH/Login/`, { method: 'POST' })).status).toBe(503);
      expect((await fetch(`${url}/health`)).status).toBe(200);
      connected = true;
      lifecycle.beginDrain();
      const busy = await fetch(`${url}/matchmake/joinOrCreate/durak`, { method: 'POST' });
      expect(busy.status).toBe(503);
      expect(busy.headers.get('retry-after')).toBe('5');
      expect((await fetch(`${url}/matchmake/reconnect/room-id`, { method: 'POST' })).status).toBe(
        200,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('keeps active games alive until they finish during the grace period', async () => {
    let elapsed = 0;
    let active = 1;
    const shutdown = vi.fn(async () => {});
    await drainActiveGames({
      activeRooms: async () => active,
      shutdown,
      drainMs: 30_000,
      now: () => elapsed,
      wait: async (ms) => {
        expect(shutdown).not.toHaveBeenCalled();
        elapsed += ms;
        if (elapsed >= 1500) active = 0;
      },
    });
    expect(elapsed).toBe(1500);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('protects Colyseus matchmaking itself while existing players can still play', async () => {
    const lifecycle = new ServerLifecycle();
    const httpServer = http.createServer(express());
    const gameServer = new Server({ server: httpServer, gracefullyShutdown: false, greet: false });
    gameServer.define('drainProbe', DrainProbeRoom);
    protectServerRequests(httpServer, createReadinessGate(lifecycle));
    await gameServer.listen(0, '127.0.0.1');
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP listener');
    const client = new Client(`ws://127.0.0.1:${address.port}`);
    const room = await client.create<DrainProbeState>('drainProbe');
    room.onMessage('*', () => {});
    try {
      const alias = await fetch(
        `http://127.0.0.1:${address.port}/prefix/matchmake/create/drainProbe`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      expect(alias.status).toBe(404);
      const queryAlias = await fetch(
        `http://127.0.0.1:${address.port}/health?next=/matchmake/create/drainProbe`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      expect(queryAlias.status).toBe(404);
      lifecycle.beginDrain();
      const rejected = await fetch(`http://127.0.0.1:${address.port}/matchmake/create/drainProbe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(rejected.status).toBe(503);
      const played = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Existing play was interrupted')), 2000);
        room.onStateChange((state) => {
          if (state.moves !== 1) return;
          clearTimeout(timeout);
          resolve();
        });
      });
      room.send('play');
      await played;
    } finally {
      await room.leave();
      await gameServer.gracefullyShutdown(false);
    }
  });

  it('closes unfinished games at the configured deadline instead of waiting forever', async () => {
    let elapsed = 0;
    const shutdown = vi.fn(async () => {});
    await drainActiveGames({
      activeRooms: async () => 1,
      shutdown,
      drainMs: 1000,
      now: () => elapsed,
      wait: async (ms) => {
        expect(shutdown).not.toHaveBeenCalled();
        elapsed += ms;
      },
    });
    expect(elapsed).toBe(1000);
    expect(shutdown).toHaveBeenCalledOnce();
  });
});
