// Screenshot every character clip at its peak from the dev preview page.
//
//   npm run dev:client                    # in another terminal
//   npm run character:shots -- [outDir] [--views=front,close] [--presets=casual]
//
// Drives the installed Google Chrome through playwright-core; set CHROME_PATH to use
// another Chromium, and PREVIEW_URL for another dev server.
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const option = (name, fallback) =>
  (args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback).split(',');
const outDir = args.find((a) => !a.startsWith('--')) ?? 'output/character-preview';
const base = process.env.PREVIEW_URL ?? 'http://localhost:5173/character.html';
const views = option('views', 'front,close');
const presets = option('presets', 'casual');

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: 'chrome' }),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
await fs.mkdir(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto(base);
const clips = await page.$$eval('#controls label:first-child select option', (options) =>
  options.map((o) => o.value),
);
const peaks = await page.evaluate(async () => {
  const { ACTIONS, EMOTES, REACTIONS } = await import('/src/character/animations/registry.ts');
  const peak = (clip) => clip.peak ?? clip.duration / 2;
  return {
    ...Object.fromEntries(Object.entries(EMOTES).map(([id, c]) => [`emote:${id}`, peak(c)])),
    ...Object.fromEntries(Object.entries(REACTIONS).map(([id, c]) => [`reaction:${id}`, peak(c)])),
    ...Object.fromEntries(Object.entries(ACTIONS).map(([id, c]) => [`action:${id}`, peak(c.R)])),
  };
});
for (const preset of presets)
  for (const clip of clips)
    for (const view of views) {
      const count = clip === 'reaction:victory' ? 0 : 5;
      await page.goto(
        `${base}?clip=${clip}&view=${view}&preset=${preset}&count=${count}&at=${peaks[clip]}`,
      );
      await page.waitForTimeout(900);
      const file = `${outDir}/${preset}-${clip.replace(':', '-')}-${view}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
