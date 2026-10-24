import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readNumber = (flag, fallback) => {
  const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`))?.split('=')[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
};

const seeds = readNumber('--seeds', 120);
const holdoutSeeds = readNumber('--holdout', 500);
const workers = readNumber('--workers', 4);
const root = resolve(import.meta.dirname, '..');
const historyPath = resolve(root, 'output/bot-duel/history.json');
const priorRuns = existsSync(historyPath)
  ? JSON.parse(readFileSync(historyPath, 'utf8')).length
  : 0;
const seedBase = readNumber('--seed-base', 500000 + priorRuns * 1000000);
console.log(`Duel lab seed base: ${seedBase}; workers: ${workers}`);
const env = {
  ...process.env,
  BOT_DUEL_RUN: '1',
  BOT_DUEL_PROMOTE: '1',
  BOT_DUEL_SEEDS: String(seeds),
  BOT_DUEL_HOLDOUT: String(holdoutSeeds),
  BOT_DUEL_SEED_BASE: String(seedBase),
  BOT_DUEL_WORKERS: String(workers),
};
const vitest = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', 'packages/server/tests/botDuel.test.ts'],
  {
    cwd: root,
    env,
    stdio: 'inherit',
  },
);
if (vitest.status !== 0) process.exit(vitest.status ?? 1);
const report = spawnSync(process.execPath, [resolve(root, 'scripts/bot-lab-report.mjs'), 'duel'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(report.status ?? 1);
