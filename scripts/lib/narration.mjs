// The sound and text of a recorded scene: its spoken lines and sound effects mixed in at their
// beats, word-by-word captions (a few words at a time, the spoken word highlighted) and any
// on-screen text, burned in.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { ensureSounds, tableSounds } from './sfx.mjs';
import { readTiming, voiceFiles } from './voice-cache.mjs';

/**
 * Everything a resolved scene plays and shows: its spoken lines with their word timing, its
 * sound effects (plus the table's own, unless `tableSounds` is false) and its text overlays.
 */
export async function narration(scene, name) {
  const lines = [];
  for (const beat of scene.beats ?? []) {
    if (beat.do !== 'say' || !beat.text) continue;
    const voice = beat.voice ?? scene.voice;
    if (!voice?.id)
      throw new Error(`${name}: "${beat.text}" has no voice; give the scene a "voice"`);
    const timing = await readTiming(voice, beat.text);
    if (!timing)
      throw new Error(
        `${name}: "${beat.text}" is not voiced yet; run npm run director:voice -- ${name}`,
      );
    lines.push({ at: beat.at, file: voiceFiles(voice, beat.text).audio, volume: 1, ...timing });
  }
  const items = [
    ...(scene.tableSounds === false ? [] : tableSounds(scene.beats ?? [])),
    ...(scene.sounds ?? []),
  ];
  const sounds = await ensureSounds(items);
  return { lines, sounds, overlays: scene.overlays ?? [] };
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
const escape = (text) => text.replace(/[{}]/g, '').replace(/\n/g, '\\N');

/** An ASS subtitle script: captions for the lines, then any text overlays. */
export function captions({ lines, overlays }, width, height, offset = 0) {
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
          .map((other, o) =>
            o === w ? `{\\c&H00FFFF&}${escape(other.text)}{\\c&HFFFFFF&}` : escape(other.text),
          )
          .join(' ');
        events.push(`Dialogue: 0,${clock(from)},${clock(until)},Caption,,0,0,0,,${text}`);
      });
    });
  }
  for (const overlay of overlays) {
    const style = overlay.style === 'center' ? 'Impact' : 'Title';
    const from = overlay.at - offset;
    const until = overlay.at + (overlay.for ?? 2000) - offset;
    if (until <= 0) continue;
    // Impact text pops in: a quick scale from large.
    const pop = style === 'Impact' ? '{\\fscx140\\fscy140\\t(0,120,\\fscx100\\fscy100)}' : '';
    events.push(
      `Dialogue: 1,${clock(from)},${clock(until)},${style},,0,0,0,,${pop}${escape(overlay.text)}`,
    );
  }
  const size = Math.round(width * 0.088);
  const title = Math.round(width * 0.07);
  const impact = Math.round(width * 0.13);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Captions: bottom centre, lifted clear of the platforms' buttons and captions.
    `Style: Caption,Segoe UI Black,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.round(size * 0.09)},${Math.round(size * 0.04)},2,60,60,${Math.round(height * 0.27)},1`,
    // A hook title: black on a white box near the top, as the apps' own text looks.
    `Style: Title,Segoe UI Black,${title},&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,${Math.round(title * 0.28)},0,8,80,80,${Math.round(height * 0.12)},1`,
    // Impact text: huge, yellow, heavy outline, dead centre.
    `Style: Impact,Segoe UI Black,${impact},&H0000E5FF,&H0000E5FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.round(impact * 0.1)},${Math.round(impact * 0.05)},5,60,60,0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

/** Mix every clip of audio (each delayed to its time) and burn the subtitles onto `video`. */
export function mix({ ffmpeg, video, audio, subtitles, output, offset = 0 }) {
  const inputs = audio.flatMap((clip) => ['-i', clip.file]);
  const delayed = audio.map((clip, i) => {
    const delay = Math.max(0, clip.at - offset);
    return `[${i + 1}:a]adelay=${delay}|${delay},volume=${clip.volume ?? 1}[a${i}]`;
  });
  const sound = audio.length
    ? `${delayed.join(';')};${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0,alimiter=limit=0.95,apad[a]`
    : 'anullsrc=r=44100:cl=stereo[a]';
  // The subtitles path goes in a filter argument: forward slashes, no drive colon (relative).
  const filter = `${sound};[0:v]ass='${subtitles.replaceAll('\\', '/')}'[v]`;
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

/** Write the resolved scene where the preview page picks it up. */
export async function saveResolved(scene, name) {
  await fs.mkdir('output/scenes', { recursive: true });
  await fs.writeFile(`output/scenes/${name}.json`, `${JSON.stringify(scene, null, 2)}\n`);
}
