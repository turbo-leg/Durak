#!/usr/bin/env node
// Server load test: boots an isolated server, fills rooms with guest players and
// spectators, streams head-look at the client's real rate, and auto-plays turns.
// Reports server CPU and the bytes each client receives.
//
//   npm run load:test -- [--rooms 10] [--players 4] [--spectators 4] [--seconds 30] [--port 2767]
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'colyseus.js';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, i, all) =>
        arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs,
      [],
    ),
);
const ROOMS = Number(args.rooms ?? 10);
const PLAYERS = Number(args.players ?? 4);
const SPECTATORS = Number(args.spectators ?? 4);
const SECONDS = Number(args.seconds ?? 30);
const PORT = Number(args.port ?? 2767);
const THINK_MS = Number(args.think ?? 3000);
const LOOK_MS = 100; // packages/shared/src/presence.ts LOOK_INTERVAL_MS

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'packages', 'server');

function cpuSeconds(pid) {
  if (process.platform === 'win32') {
    const out = execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `(Get-Process -Id ${pid}).TotalProcessorTime.TotalSeconds`,
    ]);
    return Number(String(out).trim());
  }
  const [user, sys] = String(execFileSync('ps', ['-o', 'cputime=', '-p', String(pid)]))
    .trim()
    .split(':')
    .map(Number)
    .reverse();
  return user + sys * 60;
}

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('server did not start');
}

const server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'index.ts'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'development',
    // Every simulated player shares this machine's IP; lift the per-IP limits for this run.
    TRAFFIC_LIMITS: 'off',
    // Measure the raw server, above production's per-process admission caps.
    MAX_CONNECTED_CLIENTS: '5000',
    MAX_ACTIVE_ROOMS: '2000',
    MAX_ACTIVE_BOTS: '2000',
    LOG_LEVEL: 'warn',
    MONGO_URI: '',
    REDIS_URL: '',
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const stop = () => server.kill();
process.on('exit', stop);

let bytes = 0;
let messages = 0;
const timers = [];
const rooms = [];

function meter(room) {
  const ws = room.connection.transport.ws;
  ws.addEventListener('message', (event) => {
    messages++;
    bytes += event.data.byteLength ?? event.data.length ?? 0;
  });
}

function autoPlay(room) {
  let privateHand = null;
  room.onMessage('*', () => {});
  room.onMessage('private', (data) => (privateHand = data.hand));
  let busy = false;
  room.onStateChange((state) => {
    if (busy || state.phase !== 'playing' || state.currentTurn !== room.sessionId) return;
    const me = state.players.get(room.sessionId);
    const hand = privateHand ?? (me?.hand ? [...me.hand] : []);
    busy = true;
    // Humans think for a few seconds; the game should stay live through the window.
    setTimeout(() => {
      busy = false;
      if (room.state.currentTurn !== room.sessionId) return;
      if (room.state.activeAttackCards.length > 0) room.send('pickUp');
      else if (hand[0]) {
        const { suit, rank, isJoker } = hand[0];
        room.send('attack', { cards: [{ suit, rank, isJoker }] });
      }
    }, THINK_MS);
  });
}

try {
  await waitForServer();
  const client = new Client(`ws://localhost:${PORT}`);
  for (let r = 0; r < ROOMS; r++) {
    const options = {
      discordInstanceId: `load-${process.pid}-${r}`,
      mode: 'classic',
      maxPlayers: PLAYERS,
      handSize: 5,
    };
    const seated = [];
    for (let p = 0; p < PLAYERS; p++) {
      const room = await client.joinOrCreate('durak', { ...options, username: `load${r}-${p}` });
      meter(room);
      autoPlay(room);
      seated.push(room);
      rooms.push(room);
    }
    await sleep(300);
    for (let s = 0; s < SPECTATORS; s++) {
      const room = await client.joinById(seated[0].roomId, { spectator: true });
      meter(room);
      room.onMessage('*', () => {});
      rooms.push(room);
    }
    for (const room of seated) {
      const offset = Math.random() * LOOK_MS;
      timers.push(
        setTimeout(() => {
          timers.push(
            setInterval(() => {
              const t = Date.now() / 1000;
              room.send('look', { yaw: Math.sin(t + offset) * 0.6, pitch: Math.cos(t) * 0.2 });
            }, LOOK_MS),
          );
        }, offset),
      );
    }
  }

  await sleep(2000); // let deals and openings settle
  const cpu0 = cpuSeconds(server.pid);
  const bytes0 = bytes;
  const msgs0 = messages;
  await sleep(SECONDS * 1000);
  const cpu = cpuSeconds(server.pid) - cpu0;
  const recv = bytes - bytes0;
  const clients = rooms.length;
  const playing = new Set(
    rooms.filter((room) => room.state.phase === 'playing').map((room) => room.roomId),
  ).size;
  const result = {
    rooms: ROOMS,
    players: ROOMS * PLAYERS,
    spectators: ROOMS * SPECTATORS,
    seconds: SECONDS,
    roomsStillPlaying: playing,
    serverCpuPercent: +((cpu / SECONDS) * 100).toFixed(1),
    totalKBps: +(recv / 1024 / SECONDS).toFixed(1),
    perClientBps: Math.round(recv / SECONDS / clients),
    perClientMsgsPerSec: +((messages - msgs0) / SECONDS / clients).toFixed(1),
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  timers.forEach((t) => clearInterval(t));
  await Promise.race([Promise.allSettled(rooms.map((room) => room.leave())), sleep(2000)]);
  stop();
  process.exit();
}
