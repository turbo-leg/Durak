import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ACTIONS, type ActionId } from '../character/animations/registry';
import { clipWeight } from '../character/animation';
import { CARD_SIZE } from '../character/spec';
import { SeatedCharacter, setCharacterSource } from '../character/CharacterRig';
import {
  CHARACTER_SCALE,
  TABLE_CARD_SCALE,
  TABLE_TOP,
  tableClearance,
  type Pile,
} from '../components/three/CharacterSpace';
import { cardIntersections, loadSeated, skin, viewFrame } from './gripGeometry';

afterEach(() => setCharacterSource(undefined));

// TableRenderer's layout: attack slots before the player, the pile's centre and the deck.
const cm = (value: number) => (value * CHARACTER_SCALE) / 100;
const card = (value: number) => cm(value * CARD_SIZE);
const TARGETS: [string, ActionId, string, THREE.Vector3][] = [
  ...[-2, -1, 0, 1, 2].map((k): [string, ActionId, string, THREE.Vector3] => [
    `play to slot ${k}`,
    'play',
    'table',
    new THREE.Vector3(k * card(9.5), TABLE_TOP + cm(0.3), card(2)),
  ]),
  ['pickup', 'pickup', 'table', new THREE.Vector3(cm(2), TABLE_TOP + cm(3), -cm(4))],
  ['draw', 'draw', 'deck', new THREE.Vector3(-card(36), TABLE_TOP + cm(4), card(1))],
];

/**
 * A palm step this long (metres), standing out from its neighbours, is a jump. Clips once
 * flipped the arm by up to 22 cm here; a hand starting low by the hip can still correct
 * off the table's edge by a few centimetres in a frame.
 */
const JUMP = 0.09;
describe('Card actions', () => {
  // A carried card rides in the palm, so the palm must travel as smoothly as a card should.
  it.each([
    [Math.PI, 1],
    [Math.PI / 2, 1],
    [-Math.PI / 2, 1],
    [Math.PI, 0.7],
  ])(
    'moves the acting palm continuously, from the chair at %f, size %f',
    async (angle, size) => {
      const { body, scene, pose } = await loadSeated(angle, size);
      const rotation = body.getWorldQuaternion(new THREE.Quaternion());
      const scale = scene.getWorldScale(new THREE.Vector3());
      const palm = scene.getObjectByName('SocketPalmL')!;
      const jumps: string[] = [];
      // Fixed looks, and a head turning away from the free hand as the card goes down.
      for (const look of [0, 0.65, -0.65, 'turning'] as const)
        for (const [label, id, target, point] of TARGETS) {
          const clip = ACTIONS[id].L;
          const targets = { [target]: new THREE.Matrix4().compose(point, rotation, scale) };
          const path: THREE.Vector3[] = [];
          // Sitting still for a moment first, as a player does between actions, so nothing
          // left moving by the case before carries into this one.
          const start = look === 'turning' ? 0.65 : look;
          for (let still = 0; still < 500; still += 16)
            pose.pose({
              yaw: start,
              pitch: 0,
              reduced: false,
              count: 5,
              frame: viewFrame(pose, start, 0),
              table: tableClearance,
              dt: 0.016,
            });
          // Sampled finely, so a quick move is told from a jump: a jump is one step far
          // longer than the steps either side of it.
          for (let time = 0; time <= clip.duration; time += 4) {
            const yaw = look === 'turning' ? 0.65 * (1 - time / clip.duration) : look;
            const frame = viewFrame(pose, yaw, 0, clipWeight(clip, time));
            pose.pose({
              yaw,
              pitch: 0,
              reduced: false,
              count: 5,
              frame,
              clips: [{ clip, time, targets }],
              table: tableClearance,
              dt: 0.004,
            });
            path.push(palm.getWorldPosition(new THREE.Vector3()).divideScalar(CHARACTER_SCALE));
          }
          const steps = path.slice(1).map((at, i) => at.distanceTo(path[i]!));
          steps.forEach((step, i) => {
            const around = Math.max(steps[i - 1] ?? 0, steps[i + 1] ?? 0);
            if (step > JUMP && step > 2.2 * around)
              jumps.push(`${label}, yaw ${look}, ${i * 4} ms: ${(step * 100).toFixed(1)} cm`);
          });
        }
      expect(jumps).toEqual([]);
    },
    120000,
  );

  it('slows the hand into the end of its reach, and sets it off again, without a jolt', async () => {
    const { pose } = await loadSeated(Math.PI, 1);
    const within = (point: THREE.Vector3) =>
      (
        pose as unknown as {
          within: (side: string, point: THREE.Vector3, hand: number) => THREE.Vector3;
        }
      ).within('L', point, 0);
    const shoulder = pose.root.getObjectByName('UpperArmL')!.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(0.3, 0, 1).normalize();
    // A target running steadily out past the arm's reach: the hand's speed falls away
    // smoothly, with no step from moving to stopped (as when it hit the limit dead).
    const path = Array.from({ length: 200 }, (_, i) =>
      within(shoulder.clone().addScaledVector(out, 0.4 + i * 0.02)),
    );
    const steps = path.slice(1).map((at, i) => at.distanceTo(path[i]!));
    expect(steps[0]).toBeCloseTo(0.02, 4);
    steps.slice(1).forEach((step, i) => expect(step).toBeGreaterThan(steps[i]! * 0.8));
    expect(steps.at(-1)!).toBeLessThan(0.0005);
  });

  // The full deck as TableRenderer draws it: twelve cards at the deck's place.
  const DECK: Pile = {
    x: -card(36),
    z: card(1),
    halfX: 0.41 * TABLE_CARD_SCALE,
    halfZ: 0.6 * TABLE_CARD_SCALE,
    top: TABLE_TOP + cm(0.3) + 11 * cm(0.25) + 0.0175 * TABLE_CARD_SCALE,
  };
  const inDeck = (p: THREE.Vector3) =>
    Math.min(
      DECK.top - p.y,
      DECK.halfX - Math.abs(p.x - DECK.x),
      DECK.halfZ - Math.abs(p.z - DECK.z),
      p.y - TABLE_TOP,
    );

  it.each([0, Math.PI, Math.PI / 2, -Math.PI / 2])(
    'rests hands on the deck rather than in it, and holds cards clear of the fingers, from the chair at %f',
    async (angle) => {
      const { body, scene, pose } = await loadSeated(angle, 1);
      const rotation = body.getWorldQuaternion(new THREE.Quaternion());
      const scale = scene.getWorldScale(new THREE.Vector3());
      const held = (faceIn: boolean) =>
        SeatedCharacter.prototype.held.call(
          { model: scene } as unknown as SeatedCharacter,
          'L',
          0.6 * TABLE_CARD_SCALE,
          faceIn,
        )!;
      const deck = new THREE.Vector3(DECK.x, TABLE_TOP + cm(4), DECK.z);
      // Each action, its target and when it carries a card (face out for one drawn).
      const runs: [ActionId, string, THREE.Vector3, [number, number] | undefined, boolean][] = [
        ['draw', 'deck', deck, [520, 820], false],
        ['play', 'table', TARGETS[0]![3], [240, 540], true],
        ['pickup', 'table', TARGETS[5]![3], undefined, true],
      ];
      const faults: string[] = [];
      for (const [id, target, point, carried, faceIn] of runs) {
        const clip = ACTIONS[id].L;
        const targets = { [target]: new THREE.Matrix4().compose(point, rotation, scale) };
        for (let time = 0; time <= clip.duration; time += 16) {
          pose.pose({
            yaw: 0,
            pitch: 0,
            reduced: false,
            count: 5,
            frame: viewFrame(pose, 0, 0, clipWeight(clip, time)),
            clips: [{ clip, time, targets }],
            table: (p, r, up) => tableClearance(p, r, up, [DECK]),
            dt: 0.016,
          });
          const sample = skin(scene);
          const depth = Math.max(...sample.positions.map(inDeck));
          // Skin within 2 mm of the deck counts as resting on it.
          if (depth > 0.002 * CHARACTER_SCALE)
            faults.push(
              `${id} ${time} ms: ${((depth / CHARACTER_SCALE) * 100).toFixed(1)} cm into the deck`,
            );
          if (!carried || time < carried[0] || time > carried[1]) continue;
          const { position, quaternion } = held(faceIn);
          const card = new THREE.Matrix4().compose(
            position,
            quaternion,
            new THREE.Vector3().setScalar(TABLE_CARD_SCALE),
          );
          for (const hit of cardIntersections(sample, [card], 0.002))
            faults.push(`${id} ${time} ms: ${hit}`);
        }
      }
      expect(faults).toEqual([]);
    },
    120000,
  );
});
