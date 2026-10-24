// Render a director scene to an MP4, frame by frame, plus its caption and beat cues.
//
//   npm run dev:client                    # in another terminal
//   npm run director:record -- big-pickup [more scenes or .json paths] [--out=output/clips]
//     [--w=1080 --h=1920] [--from=0 --to=<ms>] [--frames]   (--frames also keeps the PNGs)
//     [--voice]   (mixes in the narration from `npm run director:voice` and burns in captions)
//
// Every frame is posed at exactly t = i / fps, so slow rendering never drops or smears a
// frame. Needs ffmpeg on PATH (or FFMPEG_PATH). Drives the installed Google Chrome through
// playwright-core; CHROME_PATH picks another Chromium, DIRECTOR_URL another dev server, and
// DIRECTOR_SWIFTSHADER=1 renders on the CPU when no GPU is available.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { captions, mix, narration } from './lib/narration.mjs';

const SCENES = 'packages/client/src/director/scenes';
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const scenes = args.filter((a) => !a.startsWith('--'));
const outDir = option('out', 'output/clips');
const width = Number(option('w', 1080));
const height = Number(option('h', 1920));
const keepFrames = args.includes('--frames');
const voiced = args.includes('--voice');
const base = process.env.DIRECTOR_URL ?? 'http://localhost:5173/director.html';
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
if (!scenes.length) {
  console.error('Name a scene (from packages/client/src/director/scenes) or a scene .json path.');
  process.exit(1);
}

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: 'chrome' }),
  args: [
    '--ignore-gpu-blocklist',
    ...(process.env.DIRECTOR_SWIFTSHADER
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : []),
  ],
});
await fs.mkdir(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto(`${base}?record=1&w=${width}&h=${height}`);
await page.waitForFunction(() => globalThis.director);
await page.evaluate(() => globalThis.director.ready);

for (const scene of scenes) {
  const file = scene.endsWith('.json') ? JSON.parse(await fs.readFile(scene, 'utf8')) : scene;
  const name = path.basename(scene, '.json');
  let lines;
  if (voiced) {
    try {
      const data =
        typeof file === 'string'
          ? JSON.parse(await fs.readFile(path.join(SCENES, `${file}.json`), 'utf8'))
          : file;
      lines = await narration(data, name);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
      continue;
    }
  }
  let info;
  try {
    info = await page.evaluate((input) => globalThis.director.load(input), file);
  } catch (error) {
    // The page's message lists every problem in the scene.
    console.error(`${name}: ${String(error.message ?? error).replace(/^.*?Error: /, '')}`);
    process.exitCode = 1;
    continue;
  }
  const from = Number(option('from', 0));
  const to = Math.min(Number(option('to', info.duration)), info.duration);
  const frames = Math.max(1, Math.round(((to - from) * info.fps) / 1000));
  const final = path.join(outDir, `${name}.mp4`);
  // A voiced take renders silent first, then gains its narration and captions.
  const video = lines ? path.join(outDir, `${name}.silent.mp4`) : final;
  const framesDir = path.join(outDir, `${name}-frames`);
  if (keepFrames) await fs.mkdir(framesDir, { recursive: true });
  const encoder = spawn(
    ffmpeg,
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(info.fps),
      '-c:v',
      'png',
      '-i',
      '-',
    ]
      .concat(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium'])
      .concat(['-movflags', '+faststart', video]),
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const encoded = new Promise((resolve, reject) => {
    encoder.on('error', reject);
    encoder.on('close', (code) =>
      code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve(),
    );
  });
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = from + (i * 1000) / info.fps;
    const url = await page.evaluate((at) => globalThis.director.frame(at), t);
    const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (keepFrames)
      await fs.writeFile(path.join(framesDir, `${String(i).padStart(5, '0')}.png`), png);
    if (!encoder.stdin.write(png))
      await new Promise((resolve) => encoder.stdin.once('drain', resolve));
    if (i % info.fps === 0) process.stdout.write(`\r${name}: ${i}/${frames} frames`);
  }
  encoder.stdin.end();
  await encoded;
  if (lines) {
    const subtitles = path.join(outDir, `${name}.ass`);
    await fs.writeFile(subtitles, captions(lines, width, height, from));
    await mix({ ffmpeg, video, lines, subtitles, output: final, offset: from });
    await fs.rm(video);
  }
  const cues = await page.evaluate(() => globalThis.director.cues());
  await fs.writeFile(path.join(outDir, `${name}.cues.json`), `${JSON.stringify(cues, null, 2)}\n`);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const voice = lines ? `, ${lines.length} narrated lines` : '';
  console.log(
    `\r${final}  (${frames} frames at ${info.fps} fps, ${width}x${height}${voice}, ${seconds}s)`,
  );
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
