import { Server, matchMaker } from 'colyseus';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
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
import { shopRouter } from './src/routes/shop';
import { getTierInfo } from '@durak/shared';
import { CoinTransaction } from './src/models/CoinTransaction';
import { isSameUTCDay, COIN_REWARDS, awardCoins } from './src/utils/coins';
import { iapRouter } from './src/routes/iap';
import { friendsRouter } from './src/routes/friends';
import { teamsRouter } from './src/routes/teams';
import { notificationsRouter } from './src/routes/notifications';

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

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'iloveyou',
  'admin123',
  'letmein1',
  'welcome1',
  'monkey123',
  'dragon123',
  'master123',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'abc12345',
  'shadow123',
  'superman',
  'michael1',
  'jessica1',
  'charlie1',
]);

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

// Issue #188: security headers — helmet baseline, then override for Discord embedding
app.use(
  helmet({
    contentSecurityPolicy: false, // overridden below to allow Discord iframe
    crossOriginEmbedderPolicy: false, // Discord Activity requires this off
  }),
);
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'ALLOWALL'); // allow Discord iframe
  next();
});

app.use(cors());
app.use(express.json());

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
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      res.status(400).json({ error: 'Password is too common. Please choose a stronger password.' });
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

// GET /api/profile/search?q=username — fuzzy username search for friend/team invites
app.get('/api/profile/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'q must be at least 2 characters' });
    return;
  }
  try {
    const results = await PlayerProfile.find({
      username: { $regex: q, $options: 'i' },
    })
      .limit(10)
      .select('_id username avatarUrl eloClassic')
      .lean();
    res.json(
      results.map((p) => ({
        profileId: p._id.toString(),
        username: p.username,
        avatarUrl: p.avatarUrl,
        eloClassic: p.eloClassic,
      })),
    );
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
  }
});

// Accepts ?by=discord (default) or ?by=user
app.get('/api/profile/:id', async (req, res) => {
  try {
    const by = req.query.by === 'user' ? 'userId' : 'discordId';
    const profile = await PlayerProfile.findOne({ [by]: req.params.id }).lean();
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({
      ...profile,
      tierClassic: getTierInfo(profile.eloClassic),
      tierTeams: getTierInfo(profile.eloTeams),
    });
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
    res.json(
      leaders.map((p) => ({
        ...p,
        tierClassic: getTierInfo(p.eloClassic),
        tierTeams: getTierInfo(p.eloTeams),
      })),
    );
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

// ── Coins ─────────────────────────────────────────────────────────────────────

app.get('/api/profile/:id/coins', async (req, res) => {
  try {
    const by = req.query.by === 'user' ? 'userId' : 'discordId';
    const profile = await PlayerProfile.findOne({ [by]: req.params.id })
      .select('coins')
      .lean();
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const transactions = await CoinTransaction.find({ playerId: profile._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ balance: profile.coins ?? 0, transactions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/daily-login', async (req, res) => {
  try {
    const { discordId, userId } = req.body as { discordId?: string; userId?: string };
    if (!discordId && !userId) {
      res.status(400).json({ error: 'discordId or userId required' });
      return;
    }
    const filter = discordId ? { discordId } : { userId };
    const profile = await PlayerProfile.findOne(filter);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const now = new Date();
    if (isSameUTCDay(profile.lastDailyLogin, now)) {
      res.json({ awarded: false, balance: profile.coins ?? 0 });
      return;
    }
    await Promise.all([
      awardCoins(profile._id as any, COIN_REWARDS.DAILY_LOGIN, 'daily_login'),
      profile.updateOne({ lastDailyLogin: now }),
    ]);
    res.json({
      awarded: true,
      amount: COIN_REWARDS.DAILY_LOGIN,
      balance: (profile.coins ?? 0) + COIN_REWARDS.DAILY_LOGIN,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Cosmetic Equip ────────────────────────────────────────────────────────────

app.post('/api/profile/equip', async (req, res) => {
  try {
    const { discordId, userId, itemId, slot } = req.body as {
      discordId?: string;
      userId?: string;
      itemId: string;
      slot: 'card_back' | 'avatar_frame';
    };
    if (!discordId && !userId) {
      res.status(400).json({ error: 'discordId or userId required' });
      return;
    }
    if (!itemId || typeof itemId !== 'string') {
      res.status(400).json({ error: 'itemId required' });
      return;
    }
    if (slot !== 'card_back' && slot !== 'avatar_frame') {
      res.status(400).json({ error: 'slot must be card_back or avatar_frame' });
      return;
    }
    const filter = discordId ? { discordId } : { userId };
    const profile = await PlayerProfile.findOne(filter);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    if (!profile.ownedItems.includes(itemId)) {
      res.status(403).json({ error: 'Item not owned' });
      return;
    }
    const field = slot === 'card_back' ? 'equippedCardBack' : 'equippedAvatarFrame';
    await profile.updateOne({ [field]: itemId });
    const equipped = {
      card_back: slot === 'card_back' ? itemId : (profile.equippedCardBack ?? ''),
      avatar_frame: slot === 'avatar_frame' ? itemId : (profile.equippedAvatarFrame ?? ''),
    };
    res.json({ ok: true, equipped });
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

app.use('/api/shop', shopRouter);
app.use('/api/iap', iapRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/notifications', notificationsRouter);
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
