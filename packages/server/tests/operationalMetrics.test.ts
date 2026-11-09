import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { createMetricsHandler, createOperationalMonitor } from '../src/operations/metrics';

describe('operational metrics', () => {
  it('samples bounded process counts and memory without player or room data', () => {
    const monitor = createOperationalMonitor({
      capacity: () => ({ rooms: 25, clients: 100, bots: 0 }),
      pendingResults: () => 2,
      failedResults: () => 1,
      readiness: () => ({ ready: false, draining: false, databaseReady: true }),
      log: vi.fn(),
    });
    try {
      const metrics = monitor.snapshot();
      expect(metrics.capacity).toEqual({ rooms: 25, clients: 100, bots: 0 });
      expect(metrics.results).toEqual({ pending: 2, retrying: 1 });
      expect(metrics.memory.rssBytes).toBeGreaterThan(0);
      expect(metrics.eventLoop.p99Ms).toBeGreaterThanOrEqual(0);
      expect(Object.keys(metrics)).toEqual([
        'uptimeSeconds',
        'capacity',
        'readiness',
        'results',
        'memory',
        'eventLoop',
      ]);
    } finally {
      monitor.close();
    }
  });

  it('disables the endpoint by default and requires the exact bearer token when enabled', async () => {
    const app = express();
    const snapshot = vi.fn(() => ({ capacity: { clients: 100 } }));
    app.get('/disabled', createMetricsHandler(snapshot));
    app.get('/metrics', createMetricsHandler(snapshot, 'review-only-token'));
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP listener');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(`${url}/disabled`)).status).toBe(404);
      expect((await fetch(`${url}/metrics`)).status).toBe(401);
      expect(
        (await fetch(`${url}/metrics`, { headers: { Authorization: 'Bearer wrong' } })).status,
      ).toBe(401);
      expect(snapshot).not.toHaveBeenCalled();
      const accepted = await fetch(`${url}/metrics`, {
        headers: { Authorization: 'Bearer review-only-token' },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.headers.get('cache-control')).toBe('no-store');
      expect(await accepted.json()).toEqual({ capacity: { clients: 100 } });
      expect(snapshot).toHaveBeenCalledOnce();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
