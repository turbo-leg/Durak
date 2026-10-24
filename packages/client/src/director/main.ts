import { compileScene, latest, SceneError, type SceneFile, type Timeline } from './scene.ts';
import { Stage } from './stage.ts';

/**
 * Development page (`/director.html`): stage a scripted table scene for promo clips, preview
 * it with a scrubber, and expose `window.director` for `npm run director:record`.
 * ?scene=<name>&w=1080&h=1920&t=<ms freeze>&record=1 (no controls or caption cues).
 */
const SCENES = import.meta.glob<SceneFile>('./scenes/*.json', { eager: true, import: 'default' });
const byName = Object.fromEntries(
  Object.entries(SCENES).map(([path, scene]) => [path.replace(/^.*\/|\.json$/g, ''), scene]),
);

const params = new URLSearchParams(location.search);
const recording = params.has('record');
const width = Number(params.get('w') ?? 1080);
const height = Number(params.get('h') ?? 1920);
document.body.classList.toggle('recording', recording);

const host = document.getElementById('stage')!;
const stage = new Stage(host, width, height);
const canvas = stage.renderer.domElement;
canvas.style.aspectRatio = `${width} / ${height}`;
const caption = document.getElementById('caption')!;
const problems = document.getElementById('problems')!;
const controls = document.getElementById('controls')!;

let timeline: Timeline | undefined;
let time = 0;
let playing = false;

let source: SceneFile | undefined;
async function load(scene: SceneFile) {
  source = scene;
  playing = false;
  problems.hidden = true;
  try {
    timeline = compileScene(scene);
  } catch (error) {
    problems.hidden = false;
    problems.textContent = error instanceof SceneError ? error.problems.join('\n') : String(error);
    throw error;
  }
  await stage.load(timeline);
  scrub.max = String(timeline.duration);
  show(Math.min(time, timeline.duration));
  return { title: timeline.title, duration: timeline.duration, fps: timeline.fps };
}

function show(t: number, settle?: boolean) {
  time = t;
  stage.seek(t, settle);
  scrub.value = String(Math.round(t));
  clock.textContent = `${(t / 1000).toFixed(2)}s / ${((timeline?.duration ?? 0) / 1000).toFixed(2)}s`;
  const line = timeline && latest(timeline.captions, t);
  const live = line && t - line.at < 2600;
  caption.hidden = recording || !live;
  if (live) caption.textContent = line.who ? `${line.who}: ${line.text}` : line.text;
}

// Controls: scene, play/pause, scrubber, and a box for pasting scene JSON.
const pick = document.createElement('select');
for (const name of Object.keys(byName)) pick.add(new Option(name, name));
pick.onchange = () => void load(byName[pick.value]!).catch(() => undefined);
const toggle = document.createElement('button');
toggle.textContent = 'Play';
toggle.onclick = () => {
  if (!timeline) return;
  if (time >= timeline.duration) show(0);
  playing = !playing;
  toggle.textContent = playing ? 'Pause' : 'Play';
  last = performance.now();
};
const scrub = document.createElement('input');
scrub.type = 'range';
scrub.min = '0';
scrub.step = '1';
scrub.oninput = () => {
  playing = false;
  toggle.textContent = 'Play';
  show(Number(scrub.value));
};
const clock = document.createElement('span');
const paste = document.createElement('button');
paste.textContent = 'Paste JSON';
paste.onclick = async () => {
  const text = await navigator.clipboard.readText().catch(() => '');
  if (text) void load(JSON.parse(text) as SceneFile).catch(() => undefined);
};
controls.append(pick, toggle, scrub, clock, paste);

let last = performance.now();
function loop(now: number) {
  if (playing && timeline) {
    const next = time + (now - last);
    if (next >= timeline.duration) {
      playing = false;
      toggle.textContent = 'Play';
      show(timeline.duration, false);
    } else show(next, false);
  }
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const initial = params.get('scene') ?? Object.keys(byName)[0];
if (initial && byName[initial]) pick.value = initial;
const ready =
  initial && byName[initial] ? load(byName[initial]).catch(() => undefined) : Promise.resolve();
if (params.has('t')) void ready.then(() => show(Number(params.get('t'))));

declare global {
  interface Window {
    director: {
      ready: Promise<unknown>;
      scenes: string[];
      load(scene: SceneFile | string): Promise<{ title: string; duration: number; fps: number }>;
      /** Render the frame at `t` ms and return it as a PNG data URL. */
      frame(t: number): string;
      /** The compiled cues, for syncing a voiceover and captions in an editor. */
      cues(): Pick<Timeline, 'title' | 'duration' | 'fps' | 'captions'> & {
        beats: SceneFile['beats'];
      };
    };
  }
}
window.director = {
  ready,
  scenes: Object.keys(byName),
  load(scene) {
    const file = typeof scene === 'string' ? byName[scene] : scene;
    if (!file) return Promise.reject(new Error(`No scene named "${String(scene)}"`));
    return load(file);
  },
  frame(t) {
    show(t);
    return canvas.toDataURL('image/png');
  },
  cues() {
    if (!timeline) throw new Error('No scene loaded');
    const { title, duration, fps, captions } = timeline;
    return { title, duration, fps, captions, beats: source?.beats ?? [] };
  },
};
