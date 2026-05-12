import { Server } from 'colyseus';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { DurakRoom } from './src/rooms/DurakRoom';
import 'dotenv/config';
import mongoose from 'mongoose';
import { PlayerProfile } from './src/models/PlayerProfile';
import { GameLog } from './src/models/GameLog';
import { User } from './src/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'durak-dev-secret-change-in-prod';

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('📦 Connected to MongoDB (Production)'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
} else {
  console.warn('⚠️ No MONGO_URI provided in .env, game logs will not be saved externally.');
}

const app = express();
app.use(cors());
app.use(express.json());

// Issue #69: Allow Discord to embed this application in an iframe
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
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
    console.error('Token exchange error:', error);
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
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '30d' });
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
    console.error('Register error:', e);
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

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '30d' });
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
    console.error('Login error:', e);
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
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
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

// ────────────────────────────────────────────────────────────────────────────

const server = http.createServer(app);
const gameServer = new Server({ server });

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
  console.log(`🎮 Durak Game server is listening on port ${port}`);
});
