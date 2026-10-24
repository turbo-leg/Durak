// Where a narrated line's audio and timing are cached: one file pair per voice, model and text,
// so editing a scene only pays for the lines that changed.
import crypto from 'node:crypto';
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

/** A scene's narrated lines: its `say` beats, in time order. */
export const sayBeats = (scene) =>
  (scene.beats ?? []).filter((beat) => beat.do === 'say' && beat.text).sort((a, b) => a.at - b.at);
