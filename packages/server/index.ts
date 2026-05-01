import { Server } from 'colyseus';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import fs from 'fs';

import { DurakRoom } from './src/rooms/DurakRoom';
import 'dotenv/config'; // Load environment variables from .env
import mongoose from 'mongoose';

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

// Token exchange endpoint for Discord Embedded App SDK
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

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
      }),
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

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

// Register the Durak game room
gameServer.define('durak', DurakRoom);

// Add colyseus monitor for debugging
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
gameServer.listen(port).then(() => {
  console.log(`🎮 Durak Game server is listening on port ${port}`);
});
