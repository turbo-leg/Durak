import { Server, matchMaker } from 'colyseus';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import * as Sentry from '@sentry/node';

import { DurakRoom } from './src/rooms/DurakRoom';
// Load .env from the monorepo root first (local dev), then fall back to cwd (Docker/prod).
// ts-node runs from packages/server/ so ../../.env resolves to the repo root.
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // cwd fallback — picks up any local packages/server/.env overrides
import mongoose from 'mongoose';
import { PlayerProfile } from './src/models/PlayerProfile';
import { GameLog } from './src/models/GameLog';
import { User } from './src/models/User';
import { createAuthHelpers } from './src/http/authHelpers';
import { createAuthRouter } from './src/http/authRoutes';
import { createProfileRouter } from './src/http/profileRoutes';
import { createShopRouter } from './src/http/shopRoutes';
import { createSettingsRouter } from './src/http/settingsRoutes';
import { createPushRouter } from './src/http/pushRoutes';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const logger = pino(
  process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty' } }
    : { level: process.env.LOG_LEVEL ?? 'info' },
);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_PLACEHOLDERS = new Set([
  'durak-dev-secret-change-in-prod',
  'change-me-in-production',
  'secret',
  '',
]);
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_PLACEHOLDERS.has(JWT_SECRET)) {
    logger.error('FATAL: JWT_SECRET is missing or uses a known insecure placeholder in production');
    process.exit(1);
  }
}
const _JWT_SECRET = JWT_SECRET ?? 'durak-dev-secret-change-in-prod';

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true,
    })
    .then(async () => {
      logger.info('Connected to MongoDB');
      await Promise.all([
        PlayerProfile.ensureIndexes(),
        GameLog.ensureIndexes(),
        User.ensureIndexes(),
      ]);
    })
    .catch((err) => {
      Sentry.captureException(err);
      logger.error({ err }, 'MongoDB connection error');
    });
} else if (process.env.NODE_ENV === 'production') {
  logger.error('FATAL: MONGO_URI must be set in production');
  process.exit(1);
} else {
  logger.warn('No MONGO_URI provided — game logs will not be saved.');
}

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Issue #69: Allow Discord to embed this application in an iframe
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── HTTP API routes ───────────────────────────────────────────────────────────
const authHelpers = createAuthHelpers(_JWT_SECRET);
app.use('/api', createAuthRouter({ jwtSecret: _JWT_SECRET, logger }));
app.use('/api', createProfileRouter());
app.use('/api', createShopRouter(authHelpers));
app.use('/api', createSettingsRouter(authHelpers));
app.use('/api', createPushRouter(authHelpers));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────────────────────────────────────

const server = http.createServer(app);

const redisUrl = process.env.REDIS_URL;
const gameServer = new Server({
  server,
  ...(redisUrl
    ? {
        presence: new RedisPresence(redisUrl),
        driver: new RedisDriver(redisUrl),
      }
    : {}),
});

gameServer
  .define('durak', DurakRoom)
  .filterBy(['discordInstanceId', 'mode', 'maxPlayers', 'handSize', 'eloTier']);

app.use('/colyseus', monitor());

const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/colyseus') || req.path.startsWith('/matchmake')) {
      return next();
    }
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const port = Number(process.env.PORT || 2567);
gameServer.listen(port, '0.0.0.0').then(() => {
  logger.info({ port }, 'Durak game server listening');
});

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Signal received, draining...');

  server.close();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const roomCount = (await matchMaker.query({ name: 'durak' })).length;
    if (roomCount === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  await gameServer.gracefullyShutdown();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
