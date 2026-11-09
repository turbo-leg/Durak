import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  expiresAt: number;
}

interface TrafficOptions {
  now?: () => number;
  maxKeys?: number;
  authPerMinute?: number;
  registrationsPerQuarterHour?: number;
  matchmakingPerMinute?: number;
  roomCreationsPerMinute?: number;
}

/** A bounded process-local limiter. Run at HTTP ingress, before Colyseus routing. */
export function createTrafficProtection(options: TrafficOptions = {}): RequestHandler {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, Bucket>();
  let nextSweep = 0;
  const consume = (key: string, limit: number, windowMs: number, time: number) => {
    let bucket = buckets.get(key);
    if (bucket && bucket.expiresAt <= time) {
      buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket) {
      if (buckets.size >= maxKeys) return { status: 503, seconds: 10 };
      bucket = { count: 0, expiresAt: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit)
      return { status: 429, seconds: Math.max(1, Math.ceil((bucket.expiresAt - time) / 1000)) };
    bucket.count++;
    return null;
  };
  return (req, res, next) => {
    // Health, assets, room WebSockets, and ordinary reads do not consume auth budgets.
    if (req.method !== 'POST') return next();
    // Express accepts trailing slashes and case variants for the same route.
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const auth = path.startsWith('/api/auth/') || path === '/api/token';
    const matchmaking = /^\/matchmake(?:\/|$)/.test(path);
    if (!auth && !matchmaking) return next();
    const time = now();
    if (time >= nextSweep) {
      for (const [key, bucket] of buckets) if (bucket.expiresAt <= time) buckets.delete(key);
      nextSweep = time + 10_000;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rules: Array<[string, number, number]> = auth
      ? [['auth', options.authPerMinute ?? 120, 60_000]]
      : [['matchmake', options.matchmakingPerMinute ?? 240, 60_000]];
    if (path === '/api/auth/register')
      rules.push(['register', options.registrationsPerQuarterHour ?? 20, 900_000]);
    if (/^\/matchmake\/(create|joinorcreate)(?:\/|$)/.test(path))
      rules.push(['create', options.roomCreationsPerMinute ?? 30, 60_000]);
    for (const [scope, limit, windowMs] of rules) {
      const denied = consume(`${scope}:${ip}`, limit, windowMs, time);
      if (!denied) continue;
      res.setHeader('Retry-After', String(denied.seconds));
      res.status(denied.status).json({
        code: denied.status,
        error:
          denied.status === 429
            ? 'Too many requests. Please wait and try again.'
            : 'The server is busy. Please try again shortly.',
      });
      return;
    }
    next();
  };
}
