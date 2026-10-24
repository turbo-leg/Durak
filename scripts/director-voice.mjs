// Voice a scene's spoken lines with ElevenLabs and print when each one plays. Lines are cached
// in output/voice, so only new or changed lines cost credits; a scripted scene is resolved to
// output/scenes/<name>.json, where the preview page picks it up.
//
//   npm run director:voice -- big-pickup [more scenes or .json paths]
//
// The scene (or a speaker in its cast) names its voice: "voice": { "id": "<voice id>" }. The key
// comes from ELEVENLABS_API_KEY or ~/.elevenlabs/key.txt and needs only text-to-speech.
import { readScene } from './lib/scenes.mjs';
import { saveResolved } from './lib/narration.mjs';
import { resolveScene } from './lib/script.mjs';
import { voiceLines } from './lib/voice.mjs';
import { readTiming, spokenLines } from './lib/voice-cache.mjs';

const scenes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!scenes.length) {
  console.error('Name a scene (from packages/client/src/director/scenes) or a scene .json path.');
  process.exit(1);
}

let spent = 0;
for (const input of scenes) {
  const { name, scene } = await readScene(input);
  console.log(`${name}:`);
  try {
    spent += await voiceLines(spokenLines(scene));
    const resolved = await resolveScene(scene);
    if (scene.script) await saveResolved(resolved, name);
    for (const beat of resolved.beats.filter((b) => b.do === 'say')) {
      const timing = await readTiming(beat.voice, beat.text);
      const end = beat.at + timing.duration;
      const who = beat.who ? `${beat.who}: ` : '';
      console.log(
        `  ${String(beat.at).padStart(5)}–${String(end).padEnd(5)} ms  ${who}${beat.text}`,
      );
    }
    console.log(`  length ${(resolved.duration / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`  ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`new characters voiced: ${spent} (about ${spent} credits)`);
