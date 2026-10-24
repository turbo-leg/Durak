import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readNumber = (flag, fallback) => {
  const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`))?.split('=')[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
};

const seeds = readNumber('--seeds', 20);
const holdoutSeeds = readNumber('--holdout', 100);
const workers = readNumber('--workers', 4);
const root = resolve(import.meta.dirname, '..');
const historyPath = resolve(root, 'output/bot-lab/history.json');
const priorRuns = existsSync(historyPath)
  ? JSON.parse(readFileSync(historyPath, 'utf8')).length
  : 0;
const seedBase = readNumber('--seed-base', 100000 + priorRuns * 1000000);
const env = {
  ...process.env,
  BOT_LAB_RUN: '1',
  BOT_LAB_PROMOTE: '1',
  BOT_LAB_SEEDS: String(seeds),
  BOT_LAB_HOLDOUT_SEEDS: String(holdoutSeeds),
  BOT_LAB_SEED_BASE: String(seedBase),
  BOT_LAB_WORKERS: String(workers),
};
console.log(`Bot lab seed base: ${seedBase}; workers: ${workers}`);
const vitest = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', 'packages/server/tests/botLab.test.ts'],
  {
    cwd: root,
    env,
    stdio: 'inherit',
  },
);
if (vitest.status !== 0) process.exit(vitest.status ?? 1);
const report = spawnSync(process.execPath, [resolve(root, 'scripts/bot-lab-report.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(report.status ?? 1);
