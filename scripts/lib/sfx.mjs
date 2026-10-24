// Sound effects from ElevenLabs, cached by prompt and length: named presets for the usual meme
// beats, any other text as a prompt, and the table's own sounds added under every card move.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { elevenLabsKey } from './voice.mjs';

export const SFX_DIR = 'output/sfx';

/** Named effects: [prompt, seconds, volume]. Anything else is sent as a prompt. */
export const PRESETS = {
  slap: ['a single playing card slapped down hard on a wooden table, close and crisp', 0.6, 0.8],
  swoosh: ['a quick swoosh of a pile of playing cards swept off a table into a hand', 0.8, 0.7],
  draw: ['one playing card slid off the top of a deck', 0.5, 0.6],
  shuffle: ['playing cards gathered and riffle shuffled quickly', 1.2, 0.6],
  boom: ['deep cinematic bass boom hit, the vine boom meme sound', 1.5, 0.9],
  scratch: ['vinyl record scratch stop', 1, 0.9],
  crickets: ['crickets chirping in an awkward silence', 3, 0.7],
  trombone: ['sad trombone wah wah wah failure sound', 2.5, 0.8],
  laugh: ['studio audience bursting into laughter, sitcom laugh track', 3, 0.6],
  drumroll: ['snare drum roll building suspense', 2.5, 0.7],
  gasp: ['a crowd gasping in shock', 1.5, 0.8],
  ding: ['bright cartoon ding, correct answer', 0.8, 0.7],
  airhorn: ['air horn blasts, meme air horn', 1.5, 0.6],
  whoosh: ['a fast cinematic whoosh transition', 0.8, 0.7],
  sting: ['a dramatic orchestral tension sting', 2, 0.7],
  bonk: ['a cartoon bonk hit on the head', 0.6, 0.8],
};

/** The prompt, length and volume for a sound item: a preset name or a free-text prompt. */
export function sound(item) {
  const preset = PRESETS[item.sfx];
  const [prompt, seconds, volume] = preset ?? [item.sfx, (item.for ?? 1500) / 1000, 0.8];
  return { prompt, seconds: item.for ? item.for / 1000 : seconds, volume: item.volume ?? volume };
}

export function sfxFile({ prompt, seconds }) {
  const hash = crypto.createHash('sha1').update(`${prompt}\n${seconds}`).digest('hex').slice(0, 16);
  return path.join(SFX_DIR, `${hash}.mp3`);
}

/** The table's own sounds for a resolved scene's beats: a slap as each card lands, and so on. */
export function tableSounds(beats) {
  const sounds = [];
  for (const beat of beats) {
    // Lands with the card: the hand lets go at 540 ms and it glides for 260 more.
    if (beat.do === 'play' || beat.do === 'defend') sounds.push({ at: beat.at + 800, sfx: 'slap' });
    else if (beat.do === 'pickup') sounds.push({ at: beat.at + 600, sfx: 'swoosh' });
    else if (beat.do === 'draw')
      for (let n = 0; n < (beat.count ?? 1); n++)
        sounds.push({ at: beat.at + n * 650 + 450, sfx: 'draw' });
    else if (beat.do === 'discard') sounds.push({ at: beat.at, sfx: 'shuffle' });
  }
  return sounds;
}

/** Generate every effect not yet cached; returns the files for the sound items, in order. */
export async function ensureSounds(items, { log = console.log } = {}) {
  await fs.mkdir(SFX_DIR, { recursive: true });
  let key;
  const out = [];
  for (const item of items) {
    const spec = sound(item);
    const file = sfxFile(spec);
    const cached = await fs.stat(file).then(
      () => true,
      () => false,
    );
    if (!cached) {
      key ??= await elevenLabsKey();
      const response = await fetch(
        'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
        {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({
            text: spec.prompt,
            duration_seconds: Math.min(30, Math.max(0.5, spec.seconds)),
            prompt_influence: 0.6,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Sound "${item.sfx}": HTTP ${response.status} ${body.slice(0, 200)}`);
      }
      await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
      log(`  sound   ${spec.seconds}s  ${item.sfx}`);
    }
    out.push({ at: item.at, file, volume: spec.volume });
  }
  return out;
}
