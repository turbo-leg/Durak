import * as THREE from 'three';
import { avatarPreset, AVATAR_PRESETS } from '@durak/shared';
import { SeatedCharacter } from './CharacterRig.ts';
import { ACTIONS, EMOTES, REACTIONS } from './animations/registry.ts';
import {
  CHARACTER_FLOOR,
  CHARACTER_SCALE,
  fanStep,
  heldCard,
  HELD_CARD_SCALE,
  SEAT_RADIUS_Z,
  TABLE_CARD_SCALE,
  TABLE_RADIUS_Z,
  TABLE_TOP,
} from '../components/three/CharacterSpace.ts';

/**
 * Development preview (`/character.html`): one character holding a fan, playing any
 * registry clip. URL parameters make it scriptable for screenshots:
 * ?clip=emote:cry&count=5&view=front&preset=sage&at=900 (`at` freezes a moment, in ms).
 */
const params = new URLSearchParams(location.search);
const state = {
  clip: params.get('clip') ?? 'emote:cry',
  count: Number(params.get('count') ?? 5),
  view: params.get('view') ?? 'front',
  preset: params.get('preset') ?? 'casual',
  frozen: params.has('at') ? Number(params.get('at')) : undefined,
  loop: params.get('loop') !== '0',
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage')!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#182b3c');
scene.add(new THREE.HemisphereLight('#fff1dc', '#5a6873', 2.2));
const sun = new THREE.DirectionalLight('#ffe2bf', 2.4);
sun.position.set(-3, 8, 6);
scene.add(sun);
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(TABLE_RADIUS_Z, TABLE_RADIUS_Z, 0.15, 64),
  new THREE.MeshStandardMaterial({ color: '#2f6382', roughness: 0.95 }),
);
scene.add(table);
const deck = new THREE.Mesh(
  new THREE.BoxGeometry(0.82 * TABLE_CARD_SCALE, 0.3 * TABLE_CARD_SCALE, 1.2 * TABLE_CARD_SCALE),
  new THREE.MeshStandardMaterial({ color: '#203a52' }),
);
deck.position.set(-1.1, TABLE_TOP + 0.05, 1.1);
scene.add(deck);
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 60);

let character: SeatedCharacter | undefined;
const cardGeometry = new THREE.BoxGeometry(0.82, 0.012, 1.2);
const cardMaterial = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.7 });
function seat() {
  character?.dispose();
  // Clips start once the body has loaded; actions need its hands.
  character = new SeatedCharacter(state.preset, () => (start(), frame()));
  // The chair faces the table centre from +Z, like a seat across from the viewer.
  character.root.position.set(0, CHARACTER_FLOOR, SEAT_RADIUS_Z);
  character.root.rotation.y = Math.PI;
  character.root.scale.setScalar(CHARACTER_SCALE);
  scene.add(character.root);
  character.fan.clear();
  const step = fanStep(state.count);
  for (let i = 0; i < state.count; i++) {
    const { angle, position } = heldCard(i, state.count, step);
    const card = new THREE.Mesh(cardGeometry, cardMaterial);
    card.position.copy(position);
    card.rotation.order = 'ZYX';
    card.rotation.set(Math.PI / 2, 0, -angle);
    card.scale.setScalar(HELD_CARD_SCALE);
    character.fan.add(card);
  }
  character.setGesture({}, 0, state.count);
  start();
}

let startedAt = performance.now();
function start() {
  startedAt = performance.now();
  if (!character) return;
  const [kind, id] = state.clip.split(':') as [string, string];
  const now = startedAt;
  // A frozen preview holds every clip at the same moment after its start.
  if (state.frozen !== undefined) character.clock = () => startedAt + state.frozen!;
  character.setGesture(kind === 'emote' ? gesture(id) : {}, 0, state.count);
  if (kind === 'reaction') character.react(id as keyof typeof REACTIONS, now);
  if (kind === 'action')
    character.act(
      id as keyof typeof ACTIONS,
      {
        table: new THREE.Vector3(0.1, TABLE_TOP + 0.02, 0.3),
        deck: deck.position.clone().setY(TABLE_TOP + 0.06),
      },
      now,
    );
}

const gesture = (id: string) => ({
  gestureId: id,
  gestureStartedAt: Date.now() - (state.frozen ?? performance.now() - startedAt),
});

const VIEWS: Record<string, [THREE.Vector3, THREE.Vector3]> = {
  // World units: the seated eyes are about 1.6 above the floor's origin, the fan about 0.8.
  front: [new THREE.Vector3(0, 1.8, -1.2), new THREE.Vector3(0, 1.1, SEAT_RADIUS_Z)],
  close: [new THREE.Vector3(0.9, 1.7, 0.4), new THREE.Vector3(0, 1.2, SEAT_RADIUS_Z)],
  side: [new THREE.Vector3(3.4, 1.4, 1.6), new THREE.Vector3(0, 0.9, SEAT_RADIUS_Z - 0.6)],
  holder: [new THREE.Vector3(0.9, 1.5, -0.4), new THREE.Vector3(-0.1, 0.85, 1.75)],
};
function frame() {
  const { width, height } = renderer.domElement.parentElement!.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  const [eye, at] = VIEWS[state.view] ?? VIEWS.front!;
  camera.position.copy(eye);
  camera.lookAt(at);
  // Gestures run on the shared clock: keep a frozen one at the same age.
  const [kind, id] = state.clip.split(':') as [string, string];
  if (state.frozen !== undefined && kind === 'emote')
    character?.setGesture(gesture(id), 0, state.count);
  character?.animate(performance.now() / 1000, false);
  renderer.render(scene, camera);
}

function loop() {
  const length = (() => {
    const [kind, id] = state.clip.split(':') as [string, string];
    if (kind === 'emote') return EMOTES[id]?.duration ?? 2000;
    if (kind === 'reaction') return REACTIONS[id as keyof typeof REACTIONS]?.duration ?? 2000;
    return ACTIONS[id as keyof typeof ACTIONS]?.R.duration ?? 1000;
  })();
  if (state.loop && state.frozen === undefined && performance.now() - startedAt > length + 600)
    start();
  frame();
  requestAnimationFrame(loop);
}

const controls = document.getElementById('controls')!;
const select = (label: string, options: string[], value: string, set: (v: string) => void) => {
  const element = document.createElement('label');
  element.textContent = `${label} `;
  const input = document.createElement('select');
  for (const option of options) input.add(new Option(option, option, false, option === value));
  input.onchange = () => set(input.value);
  element.append(input);
  controls.append(element);
};
select(
  'Clip',
  [
    ...Object.keys(EMOTES).map((id) => `emote:${id}`),
    ...Object.keys(REACTIONS).map((id) => `reaction:${id}`),
    ...Object.keys(ACTIONS).map((id) => `action:${id}`),
  ],
  state.clip,
  (v) => ((state.clip = v), start()),
);
select(
  'Cards',
  ['0', '1', '2', '3', '5', '7'],
  String(state.count),
  (v) => ((state.count = Number(v)), seat()),
);
select('View', Object.keys(VIEWS), state.view, (v) => (state.view = v));
select(
  'Character',
  AVATAR_PRESETS.map((p) => p.id),
  avatarPreset(state.preset).id,
  (v) => ((state.preset = v), seat()),
);
const replay = document.createElement('button');
replay.textContent = 'Replay';
replay.onclick = () => start();
controls.append(replay);

addEventListener('resize', frame);
seat();
loop();
