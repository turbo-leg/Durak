import { Server } from 'colyseus';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import * as Sentry from '@sentry/node';

import { DurakRoom } from './src/rooms/DurakRoom';
import 'dotenv/config';
import mongoose from 'mongoose';
import { PlayerProfile } from './src/models/PlayerProfile';
import { GameLog } from './src/models/GameLog';
import { User } from './src/models/User';

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

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // API routes don't need iframe embedding
  if (req.path.startsWith('/api') || req.path.startsWith('/matchmake')) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  } else {
    // Allow Discord and localhost to embed the Activity
    res.setHeader(
      'Content-Security-Policy',
      'frame-ancestors https://*.discord.com https://discord.com http://localhost:*',
    );
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── Discord token exchange (Embedded App SDK) ────────────────────────────────

app.post('/api/token', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      res.status(500).json({ error: 'Missing Discord credentials in server environment' });
      return;
    }

    const params: Record<string, string> = {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
    };
    if (req.body.redirect_uri) params.redirect_uri = String(req.body.redirect_uri);

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error({ err: error }, 'Token exchange error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Email / password auth ────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      res.status(400).json({ error: 'email, password, and username are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      username: username.trim().slice(0, 32),
    });

    const token = jwt.sign({ userId: user._id.toString() }, _JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error({ err: e }, 'Register error');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user._id.toString() }, _JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error({ err: e }, 'Login error');
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }
    const payload = jwt.verify(auth.slice(7), _JWT_SECRET) as { userId: string };
    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Profile & history API ────────────────────────────────────────────────────

// Accepts ?by=discord (default) or ?by=user
app.get('/api/profile/:id', async (req, res) => {
  try {
    const by = req.query.by === 'user' ? 'userId' : 'discordId';
    const profile = await PlayerProfile.findOne({ [by]: req.params.id }).lean();
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const mode = req.query.mode === 'teams' ? 'eloTeams' : 'eloClassic';
    const rawLimit = parseInt(String(req.query.limit ?? '10'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 50)) : 10;
    const leaders = await PlayerProfile.find({ 'stats.gamesPlayed': { $gte: 1 } })
      .sort({ [mode]: -1 })
      .limit(limit)
      .select('username avatarUrl eloClassic eloTeams stats.gamesPlayed')
      .lean();
    res.json(leaders);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
  }
});

app.get('/api/history/:id', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const by = req.query.by === 'user' ? 'userIds' : 'discordIds';
    const logs = await GameLog.find({ [by]: req.params.id })
      .sort({ date: -1 })
      .limit(limit)
      .select('-actionLog')
      .lean();
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

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

gameServer.define('durak', DurakRoom).filterBy(['discordInstanceId']);

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
    const roomCount = (await gameServer.driver.getRooms('durak')).length;
    if (roomCount === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  await gameServer.gracefullyShutdown();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
