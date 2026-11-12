#!/usr/bin/env node
// Post-deploy smoke test: the live server answers /ready with the database connected,
// and a real solo game against a bot deals and plays a few turns.
//
//   node scripts/smoke.mjs https://durak-discord-activity.fly.dev [--allow-degraded]
// Exits non-zero on failure; CI then rolls the release back.
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from 'colyseus.js';

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? '').replace(/\/+$/, '');
const allowDegraded = process.argv.includes('--allow-degraded');
const READY_SECONDS = Number(process.env.SMOKE_READY_SECONDS ?? 120);
if (!base) {
  console.error('Usage: node scripts/smoke.mjs <base-url> [--allow-degraded]');
  process.exit(2);
}

async function waitForReady() {
  const deadline = Date.now() + READY_SECONDS * 1000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(10_000) });
      const body = await res.json().catch(() => ({}));
      last = `${res.status} ${JSON.stringify(body)}`;
      if (res.ok && (body.databaseReady || allowDegraded)) return body;
    } catch (error) {
      last = error.message;
    }
    await sleep(3000);
  }
  throw new Error(`/ready never passed within ${READY_SECONDS}s (last: ${last})`);
}

async function playSoloGame() {
  const client = new Client(base.replace(/^http/, 'ws'));
  const room = await client.create('durak', {
    mode: 'classic',
    maxPlayers: 2,
    handSize: 5,
    isPrivate: true,
    botDifficulty: 'easy',
    username: 'smoke-test',
    src: 'ci_smoke',
  });
  room.onMessage('*', () => {});
  let hand = [];
  room.onMessage('private', (data) => (hand = data.hand ?? hand));
  // Record every turn as it happens; a bot can move faster than any polling interval.
  const turns = new Set();
  room.onStateChange((state) => {
    if (state.phase === 'playing' && state.currentTurn) turns.add(state.currentTurn);
  });
  try {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      // Two different players have had the turn: dealing, bot play and sync all work.
      if (turns.size >= 2) return;
      const { phase, currentTurn } = room.state;
      if (phase === 'finished') {
        if (turns.size >= 1) return; // the game ran to the end, so turns did pass
        throw new Error('Game finished without any turn being seen');
      }
      if (phase === 'waiting') room.send('toggleReady', { isReady: true });
      if (phase === 'playing' && currentTurn === room.sessionId) {
        if (room.state.activeAttackCards.length > 0) room.send('pickUp');
        else if (hand[0]) {
          const { suit, rank, isJoker } = hand[0];
          room.send('attack', { cards: [{ suit, rank, isJoker }] });
        }
      }
      await sleep(500);
    }
    throw new Error(`Game did not progress (phase ${room.state.phase}, turns seen ${turns.size})`);
  } finally {
    await Promise.race([room.leave(), sleep(2000)]);
  }
}

try {
  const ready = await waitForReady();
  console.log(`ready: ${JSON.stringify(ready)}`);
  await playSoloGame();
  console.log('smoke test passed: solo game dealt and turns moved');
  process.exit(0);
} catch (error) {
  console.error(`smoke test FAILED: ${error.message}`);
  process.exit(1);
}
