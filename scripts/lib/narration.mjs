// Narration for a recorded scene: the voiced `say` lines mixed in at their beats, and
// word-by-word captions burned in (a few words at a time, the spoken word highlighted).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { sayBeats, voiceFiles } from './voice-cache.mjs';

/** The scene's voiced lines with their audio and word timing; throws if any is not voiced yet. */
export async function narration(scene, name) {
  if (!scene.voice?.id) throw new Error(`${name}: the scene has no "voice"`);
  const lines = [];
  for (const beat of sayBeats(scene)) {
    const files = voiceFiles(scene.voice, beat.text);
    const timing = await fs
      .readFile(files.timing, 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    if (!timing)
      throw new Error(
        `${name}: "${beat.text}" is not voiced yet; run npm run director:voice -- ${name}`,
      );
    lines.push({ at: beat.at, audio: files.audio, ...timing });
  }
  return lines;
}

const MAX_WORDS = 3;
const MAX_CHARS = 18;
const clock = (ms) => {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const s = Math.floor(cs / 100) % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** An ASS subtitle script: short phrases, the word being spoken in yellow. */
export function captions(lines, width, height, offset = 0) {
  const events = [];
  for (const line of lines) {
    // Split the line into phrases of a few words.
    const phrases = [];
    for (const word of line.words) {
      const last = phrases.at(-1);
      const length = last ? last.map((w) => w.text).join(' ').length + 1 + word.text.length : 0;
      if (!last || last.length >= MAX_WORDS || length > MAX_CHARS) phrases.push([word]);
      else last.push(word);
    }
    phrases.forEach((phrase, p) => {
      const next = phrases[p + 1]?.[0].start;
      const end = next ?? Math.max(line.duration, phrase.at(-1).end + 300);
      phrase.forEach((word, w) => {
        const from = line.at + word.start - offset;
        const until = line.at + (phrase[w + 1]?.start ?? end) - offset;
        if (until <= 0) return;
        const text = phrase
          .map((other, o) => (o === w ? `{\\c&H00FFFF&}${other.text}{\\c&HFFFFFF&}` : other.text))
          .join(' ');
        events.push(`Dialogue: 0,${clock(from)},${clock(until)},Caption,,0,0,0,,${text}`);
      });
    });
  }
  const size = Math.round(width * 0.088);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Bottom centre, lifted clear of the platforms' buttons and captions.
    `Style: Caption,Segoe UI Black,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.round(size * 0.09)},${Math.round(size * 0.04)},2,60,60,${Math.round(height * 0.27)},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

/** Mux the lines' audio (each delayed to its beat) and burn the captions onto `video`. */
export function mix({ ffmpeg, video, lines, subtitles, output, offset = 0 }) {
  const inputs = lines.flatMap((line) => ['-i', line.audio]);
  const delayed = lines.map((line, i) => {
    const delay = Math.max(0, line.at - offset);
    return `[${i + 1}:a]adelay=${delay}|${delay}[a${i}]`;
  });
  const audio = lines.length
    ? `${delayed.join(';')};${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad[a]`
    : 'anullsrc=r=44100:cl=stereo[a]';
  // The subtitles path goes in a filter argument: forward slashes, no drive colon (relative).
  const filter = `${audio};[0:v]ass='${subtitles.replaceAll('\\', '/')}'[v]`;
  const args = ['-y', '-loglevel', 'error', '-i', video, ...inputs, '-filter_complex', filter]
    .concat(['-map', '[v]', '-map', '[a]', '-shortest'])
    .concat(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium'])
    .concat(['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) =>
      code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve(),
    );
  });
}
