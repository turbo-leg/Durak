import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';
import { resolve } from 'node:path';

const require = createRequire(resolve(import.meta.dirname, '../packages/server/package.json'));
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    experimentalDecorators: true,
    useDefineForClassFields: false,
  },
});
const { playBotMatch } = require(
  resolve(import.meta.dirname, '../packages/server/tests/botMatch.ts'),
);

parentPort.on('message', async ({ id, matches }) => {
  try {
    const results = [];
    for (const match of matches)
      results.push(await playBotMatch(match.seed, match.seat, match.policy, match.options));
    parentPort.postMessage({ id, results });
  } catch (error) {
    parentPort.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
  }
});
