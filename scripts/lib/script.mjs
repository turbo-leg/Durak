// Scenes written as a script: spoken lines in order, and everything else pinned to a word of the
// last line ("word"), to the previous item ("after") or to a time ("at"). Resolving it with the
// voiced lines' word timings gives the plain timed scene the stage plays.
import { readTiming, voiceFor } from './voice-cache.mjs';

const GAP_MS = 250;
const START_MS = 200;
const TAIL_MS = 1200;
// A played card lands this long after the play starts: the hand lets go, then it glides.
const LANDING_MS = 800;
const TIMING = ['at', 'word', 'after', 'offset', 'land', 'pause'];

const normal = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** When a word (`"долоо"`, or `"долоо#2"` for the second) starts within a voiced line. */
function wordStart(line, target) {
  const [word, nth = '1'] = target.split('#');
  const wanted = normal(word);
  const matches = line.timing.words.filter((w) => {
    const text = normal(w.text);
    return text === wanted || text.startsWith(wanted);
  });
  const found = matches[Number(nth) - 1];
  if (!found) {
    const said = line.timing.words.map((w) => w.text).join(' ');
    throw new Error(`"word": "${target}" is not in the line before it: ${said}`);
  }
  return line.at + found.start;
}

/** Mouth shapes for a spoken line: the jaw opens once per vowel and closes between words. */
export function mouthShapes(timing) {
  const keys = [];
  for (const word of timing.words) {
    const vowels = word.text.match(/[аэиоуөүыеёюяaeiou]/giu) ?? ['a'];
    const span = Math.max(80, word.end - word.start);
    vowels.forEach((vowel, k) => {
      const peak = word.start + (span * (k + 0.5)) / vowels.length;
      const wide = /[аоэяёAOE]/iu.test(vowel) ? 0.85 : 0.55;
      keys.push([Math.round(peak - span / vowels.length / 3), 0.12], [Math.round(peak), wide]);
    });
    keys.push([word.end, 0.04]);
  }
  // Keep the keys in time order with no repeats, as the clip expects.
  return keys
    .sort((a, b) => a[0] - b[0])
    .filter((key, i, all) => i === 0 || key[0] > all[i - 1][0])
    .map(([t, open]) => [Math.max(0, t), open]);
}

/**
 * The timed scene for a scene with a `script`; a scene without one comes back unchanged except
 * for its `sounds` and `overlays`. Every spoken line must be voiced already.
 */
export async function resolveScene(scene) {
  const beats = (scene.beats ?? []).map((beat) => ({ ...beat }));
  const camera = (scene.camera ?? []).map((shot) => ({ ...shot }));
  const sounds = [...(scene.sounds ?? [])];
  const overlays = [...(scene.overlays ?? [])];
  let last; // The last spoken line: { at, timing }.
  let previous = 0;
  let spokenEnd = 0;
  let end = 0;
  for (const [index, item] of (scene.script ?? []).entries()) {
    const where = `script[${index}]`;
    const speaks = typeof item.say === 'string';
    let at;
    try {
      if (typeof item.at === 'number') at = item.at;
      else if (item.word) {
        if (!last) throw new Error(`"word" needs a spoken line before it`);
        at = wordStart(last, item.word);
      } else if (typeof item.after === 'number') at = previous + item.after;
      // A line follows the last after a short gap, or a longer `pause` to let a joke land.
      else at = speaks ? (last ? spokenEnd + (item.pause ?? GAP_MS) : START_MS) : previous;
    } catch (error) {
      throw new Error(`${where}: ${error.message}`);
    }
    at += item.offset ?? 0;
    // A card pinned to a word lands on it, rather than leaving the hand then.
    if ((item.do === 'play' || item.do === 'defend') && item.word && item.land !== false)
      at -= LANDING_MS;
    at = Math.max(0, Math.round(at));
    previous = at;
    const rest = Object.fromEntries(Object.entries(item).filter(([key]) => !TIMING.includes(key)));
    if (speaks) {
      const voice = voiceFor(scene, item);
      const timing = voice && (await readTiming(voice, item.say));
      if (!timing)
        throw new Error(`${where}: "${item.say}" is not voiced yet; run npm run director:voice`);
      last = { at, timing };
      spokenEnd = at + timing.duration;
      end = Math.max(end, spokenEnd);
      const { say, ...others } = rest;
      beats.push({
        ...others,
        at,
        do: 'say',
        text: say,
        ...(item.who && { mouth: mouthShapes(timing) }),
      });
    } else if (item.shot) {
      camera.push({ ...rest, at });
    } else if (item.text !== undefined && !item.do) {
      overlays.push({ ...rest, at });
      end = Math.max(end, at + (item.for ?? 2000));
    } else if (item.sfx) {
      sounds.push({ ...rest, at });
    } else {
      beats.push({ ...rest, at });
      end = Math.max(end, at + 1500);
    }
  }
  const resolved = { ...scene, beats, camera, sounds, overlays };
  delete resolved.script;
  // `tail` holds the last shot longer, as for an outro sound.
  resolved.duration = scene.duration ?? Math.max(end + (scene.tail ?? TAIL_MS), 1000);
  // Say beats carry their voice, so the mix needs nothing else to find their audio.
  resolved.beats = beats
    .map((beat) => (beat.do === 'say' ? { ...beat, voice: voiceFor(scene, beat) } : beat))
    .sort((a, b) => a.at - b.at);
  resolved.camera = camera.sort((a, b) => a.at - b.at);
  return resolved;
}
