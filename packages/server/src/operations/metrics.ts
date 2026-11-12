import { timingSafeEqual } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

interface MetricsSources {
  capacity: () => { rooms: number; clients: number; bots: number };
  pendingResults: () => number;
  failedResults: () => number;
  readiness: () => {
    ready: boolean;
    degraded: boolean;
    draining: boolean;
    databaseReady: boolean;
  };
  log: (metrics: unknown) => void;
}

/** Constant-size process measurements: never retain room IDs, players, or card data. */
export function createOperationalMonitor(sources: MetricsSources) {
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();
  const milliseconds = (nanoseconds: number) => Math.round(nanoseconds / 1000) / 1000;
  const snapshot = () => {
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      capacity: sources.capacity(),
      readiness: sources.readiness(),
      results: { pending: sources.pendingResults(), retrying: sources.failedResults() },
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      eventLoop: {
        p95Ms: milliseconds(loopDelay.percentile(95)),
        p99Ms: milliseconds(loopDelay.percentile(99)),
        maxMs: milliseconds(loopDelay.max),
      },
    };
  };
  const interval = setInterval(() => {
    sources.log(snapshot());
    loopDelay.reset();
  }, 30_000);
  interval.unref();
  return {
    snapshot,
    close() {
      clearInterval(interval);
      loopDelay.disable();
    },
  };
}

export function createMetricsHandler(snapshot: () => unknown, token?: string): RequestHandler {
  const expected = token ? Buffer.from(`Bearer ${token}`) : undefined;
  return (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!expected) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const supplied = Buffer.from(req.get('authorization') ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(snapshot());
  };
}
