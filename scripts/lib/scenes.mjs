// Reading scene files: a bare name is a bundled scene, anything ending in .json is a path.
import fs from 'node:fs/promises';
import path from 'node:path';

export const SCENES_DIR = 'packages/client/src/director/scenes';

export async function readScene(input) {
  const file = input.endsWith('.json') ? input : path.join(SCENES_DIR, `${input}.json`);
  const scene = JSON.parse(await fs.readFile(file, 'utf8'));
  return { name: path.basename(input, '.json'), scene };
}
