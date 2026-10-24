import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const number = (flag, fallback) => {
  const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`))?.split('=')[1];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
};
const root = resolve(import.meta.dirname, '..');
const historyPath = resolve(root, 'output/bot-selfplay/history.json');
const runs = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')).length : 0;
const seedBase = number('--seed-base', 20000000 + runs * 1000000);
const env = {
  ...process.env,
  BOT_SELFPLAY_RUN: '1',
  BOT_SELFPLAY_PROMOTE: '1',
  BOT_SELFPLAY_GENERATIONS: String(number('--generations', 4)),
  BOT_SELFPLAY_POPULATION: String(number('--population', 16)),
  BOT_SELFPLAY_SEEDS: String(number('--seeds', 80)),
  BOT_SELFPLAY_HOLDOUT: String(number('--holdout', 500)),
  BOT_SELFPLAY_WORKERS: String(number('--workers', 4)),
  BOT_SELFPLAY_SEED_BASE: String(seedBase),
};
console.log(`Self-play seed base: ${seedBase}; workers: ${env.BOT_SELFPLAY_WORKERS}`);
const test = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    'packages/server/tests/botSelfPlay.test.ts',
    '--exclude',
    '**/.claude/**',
  ],
  { cwd: root, env, stdio: 'inherit' },
);
if (test.status !== 0) process.exit(test.status ?? 1);
const report = spawnSync(process.execPath, [resolve(root, 'scripts/bot-selfplay-report.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(report.status ?? 1);
