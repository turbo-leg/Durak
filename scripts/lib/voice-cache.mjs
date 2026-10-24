// Where a spoken line's audio and timing are cached: one file pair per voice, model and text,
// so editing a scene only pays for the lines that changed.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const VOICE_DIR = 'output/voice';
export const DEFAULT_MODEL = 'eleven_v4';

export function voiceFiles(voice, text, dir = VOICE_DIR) {
  const model = voice.model ?? DEFAULT_MODEL;
  const hash = crypto
    .createHash('sha1')
    .update(`${voice.id}\n${model}\n${text}`)
    .digest('hex')
    .slice(0, 16);
  return { audio: path.join(dir, `${hash}.mp3`), timing: path.join(dir, `${hash}.json`) };
}

/** The voice a line is spoken in: its own, its speaker's, or the scene's narrator. */
export function voiceFor(scene, item) {
  if (item.voice) return typeof item.voice === 'string' ? { id: item.voice } : item.voice;
  const speaker =
    item.who && scene.cast?.find((m) => m.name.toLowerCase() === item.who.toLowerCase());
  if (speaker?.voice)
    return typeof speaker.voice === 'string' ? { id: speaker.voice } : speaker.voice;
  return scene.voice;
}

/** Every spoken line in a scene, from its `script` (`say` items) or its `say` beats. */
export function spokenLines(scene) {
  const items = [
    ...(scene.script ?? [])
      .filter((item) => typeof item.say === 'string')
      .map((item) => ({ ...item, text: item.say })),
    ...(scene.beats ?? []).filter((beat) => beat.do === 'say' && beat.text),
  ];
  return items.map((item) => ({ text: item.text, who: item.who, voice: voiceFor(scene, item) }));
}

/** A voiced line's cached timing, or undefined if it has not been voiced. */
export const readTiming = (voice, text) =>
  fs
    .readFile(voiceFiles(voice, text).timing, 'utf8')
    .then(JSON.parse)
    .catch(() => undefined);
