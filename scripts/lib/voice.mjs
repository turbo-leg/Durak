// ElevenLabs text to speech with timestamps: each new line becomes an MP3 and the spoken span
// of every word, cached by voice, model and text (see voice-cache.mjs).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_MODEL, readTiming, VOICE_DIR, voiceFiles } from './voice-cache.mjs';

/** The API key from ELEVENLABS_API_KEY or ~/.elevenlabs/key.txt. */
export async function elevenLabsKey() {
  const key = (
    process.env.ELEVENLABS_API_KEY ??
    (await fs.readFile(path.join(os.homedir(), '.elevenlabs', 'key.txt'), 'utf8').catch(() => ''))
  ).trim();
  if (!key)
    throw new Error(
      'No ElevenLabs key: set ELEVENLABS_API_KEY or save it to ~/.elevenlabs/key.txt.',
    );
  return key;
}

/** Whole words with their spoken span (ms), from ElevenLabs' per-character timing. */
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

/**
 * Voice every line not yet cached. `lines` are `{ text, voice }`; returns how many characters
 * were sent (about the credits spent). Failures are reported per line and thrown at the end.
 */
export async function voiceLines(lines, { log = console.log } = {}) {
  await fs.mkdir(VOICE_DIR, { recursive: true });
  let key;
  let spent = 0;
  const failed = [];
  for (const { text, voice } of lines) {
    if (!voice?.id) {
      failed.push(`"${text}": no voice; give the scene (or the speaker) a "voice"`);
      continue;
    }
    let timing = await readTiming(voice, text);
    if (!timing) {
      key ??= await elevenLabsKey();
      const model = voice.model ?? DEFAULT_MODEL;
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: model,
            // v3 detects Mongolian itself but refuses it by name; v4 takes the code.
            ...(model.startsWith('eleven_v3') ? {} : { language_code: voice.language ?? 'mn' }),
            ...(voice.settings && { voice_settings: voice.settings }),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        failed.push(
          `"${text}": HTTP ${response.status} ${body?.detail?.message ?? JSON.stringify(body).slice(0, 200)}`,
        );
        continue;
      }
      const files = voiceFiles(voice, text);
      await fs.writeFile(files.audio, Buffer.from(body.audio_base64, 'base64'));
      const ends = body.alignment.character_end_times_seconds;
      timing = {
        text,
        duration: Math.round(ends[ends.length - 1] * 1000),
        words: words(body.alignment),
      };
      await fs.writeFile(files.timing, `${JSON.stringify(timing, null, 2)}\n`);
      spent += text.length;
      log(`  voiced  ${(timing.duration / 1000).toFixed(2)}s  ${text}`);
    }
  }
  if (failed.length) throw new Error(`Some lines could not be voiced:\n${failed.join('\n')}`);
  return spent;
}
