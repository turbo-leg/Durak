// Voice a scene's narration with ElevenLabs: every `say` beat becomes an MP3 plus the timing
// of each word, cached in output/voice so only new or changed lines cost credits.
//
//   npm run director:voice -- big-pickup [more scenes or .json paths]
//
// The scene names its voice: "voice": { "id": "<ElevenLabs voice id>", "model": "eleven_v4" }.
// The API key comes from ELEVENLABS_API_KEY or ~/.elevenlabs/key.txt and needs only the
// text-to-speech permission. Afterwards `npm run director:record -- <scene> --voice` mixes the
// lines in at their beats and burns in captions.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_MODEL, sayBeats, VOICE_DIR, voiceFiles } from './lib/voice-cache.mjs';

const SCENES = 'packages/client/src/director/scenes';
const scenes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!scenes.length) {
  console.error('Name a scene (from packages/client/src/director/scenes) or a scene .json path.');
  process.exit(1);
}
const key = (
  process.env.ELEVENLABS_API_KEY ??
  (await fs.readFile(path.join(os.homedir(), '.elevenlabs', 'key.txt'), 'utf8').catch(() => ''))
).trim();
if (!key) {
  console.error('No ElevenLabs key: set ELEVENLABS_API_KEY or save it to ~/.elevenlabs/key.txt.');
  process.exit(1);
}
await fs.mkdir(VOICE_DIR, { recursive: true });

/** Whole words with their spoken span, from ElevenLabs' per-character timing. */
function words({
  characters,
  character_start_times_seconds: starts,
  character_end_times_seconds: ends,
}) {
  const found = [];
  let word;
  characters.forEach((char, i) => {
    if (/\s/.test(char)) {
      word = undefined;
      return;
    }
    if (!word) found.push((word = { text: '', start: starts[i], end: ends[i] }));
    word.text += char;
    word.end = ends[i];
  });
  return found.map((w) => ({
    text: w.text,
    start: Math.round(w.start * 1000),
    end: Math.round(w.end * 1000),
  }));
}

let spent = 0;
for (const scene of scenes) {
  const file = scene.endsWith('.json') ? scene : path.join(SCENES, `${scene}.json`);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const voice = data.voice;
  if (!voice?.id) {
    console.error(`${scene}: add "voice": { "id": "<voice id>" } to the scene`);
    process.exitCode = 1;
    continue;
  }
  const model = voice.model ?? DEFAULT_MODEL;
  console.log(`${scene} (${model}):`);
  for (const beat of sayBeats(data)) {
    const files = voiceFiles(voice, beat.text);
    let timing = await fs
      .readFile(files.timing, 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    if (!timing) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({
            text: beat.text,
            model_id: model,
            // v3 detects Mongolian itself but refuses it by name; v4 takes the code.
            ...(model.startsWith('eleven_v3') ? {} : { language_code: voice.language ?? 'mn' }),
            ...(voice.settings && { voice_settings: voice.settings }),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(
          `  ${beat.text}\n  HTTP ${response.status}: ${body?.detail?.message ?? JSON.stringify(body).slice(0, 200)}`,
        );
        process.exitCode = 1;
        continue;
      }
      await fs.writeFile(files.audio, Buffer.from(body.audio_base64, 'base64'));
      const alignment = body.alignment;
      const ends = alignment.character_end_times_seconds;
      timing = {
        text: beat.text,
        duration: Math.round(ends[ends.length - 1] * 1000),
        words: words(alignment),
      };
      await fs.writeFile(files.timing, `${JSON.stringify(timing, null, 2)}\n`);
      spent += beat.text.length;
    }
    const end = beat.at + timing.duration;
    console.log(
      `  ${String(beat.at).padStart(5)}–${String(end).padEnd(5)} ms  ${(timing.duration / 1000).toFixed(2)}s  ${beat.text}`,
    );
  }
}
console.log(`new characters voiced: ${spent} (about ${spent} credits)`);
