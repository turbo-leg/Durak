// One command from scene to finished reel: voice the new lines, start a private dev server,
// render with sound effects, captions and text, and (with --open) play the result.
//
//   npm run reel -- big-pickup [more scenes or .json paths] [--open] [any director:record option]
//
// Needs ffmpeg, Google Chrome and an ElevenLabs key (see director-voice.mjs).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readScene } from './lib/scenes.mjs';
import { voiceLines } from './lib/voice.mjs';
import { spokenLines } from './lib/voice-cache.mjs';

const args = process.argv.slice(2);
const scenes = args.filter((a) => !a.startsWith('--'));
const open = args.includes('--open');
const passed = args.filter((a) => a.startsWith('--') && a !== '--open');
if (!scenes.length) {
  console.error('Name a scene (from packages/client/src/director/scenes) or a scene .json path.');
  process.exit(1);
}

for (const input of scenes) {
  const { name, scene } = await readScene(input);
  const spent = await voiceLines(spokenLines(scene)).catch((error) => {
    console.error(`${name}: ${error.message}`);
    process.exit(1);
  });
  if (spent) console.log(`${name}: voiced ${spent} new characters`);
}

// A private dev server on a free port, so nothing else has to be running. Vite belongs to the
// client package, so this loads the copy it depends on.
const vite = createRequire(path.resolve('packages/client/package.json')).resolve('vite');
const { createServer } = await import(pathToFileURL(vite).href);
const server = await createServer({
  root: 'packages/client',
  configFile: 'packages/client/vite.config.ts',
  logLevel: 'error',
  // Nothing edits files during a take: no watching, so nothing can reload the page mid-render.
  server: { port: 5390, strictPort: false, hmr: false, watch: null },
});
await server.listen();
const url = `${server.resolvedUrls.local[0].replace(/\/$/, '')}/director.html`;
try {
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['scripts/director-record.mjs', ...scenes, '--voice', ...passed],
      {
        stdio: 'inherit',
        env: { ...process.env, DIRECTOR_URL: url },
      },
    );
    child.on('close', resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await server.close();
}

if (open && !process.exitCode) {
  const out = passed.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'output/clips';
  for (const input of scenes) {
    const video = path.resolve(out, `${path.basename(input, '.json')}.mp4`);
    const opener =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', video]]
        : process.platform === 'darwin'
          ? ['open', [video]]
          : ['xdg-open', [video]];
    spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
  }
}
