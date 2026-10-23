/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GESTURES, LOOK_PITCH_MAX, LOOK_PITCH_MIN, LOOK_YAW_LIMIT } from '@durak/shared';
import { ACTIONS, EMOTES, FREE_HAND_EMOTES, REACTIONS } from '../character/animations/registry';
import { holdingHand } from '../character/CharacterPose';
import { BODY, SKULL } from '../character/spec';
import {
  FirstPersonCharacter,
  SeatedCharacter,
  setCharacterSource,
} from '../character/CharacterRig';
import { CHARACTER_SCALE, fanHalfAngle } from '../components/three/CharacterSpace';
import {
  cardIntersections,
  cardSides,
  digitClearance,
  fanCards,
  handGap,
  loadCharacter,
  skin,
  viewFrame,
} from './gripGeometry';

const at = (scene: THREE.Object3D, name: string) =>
  scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
const HANDS = [
  [1, Infinity],
  [2, Infinity],
  [3, Infinity],
  [5, Infinity],
  [7, Infinity],
  // A narrow phone viewport compresses a large local hand.
  [12, 0.46],
] as const;
const GAZE = [
  [0, 0],
  [-LOOK_YAW_LIMIT, LOOK_PITCH_MIN],
  [LOOK_YAW_LIMIT, LOOK_PITCH_MAX],
] as const;
afterEach(() => {
  vi.restoreAllMocks();
  setCharacterSource(undefined);
});

describe('Character card grip', () => {
  it.each([
    ['first person', true],
    ['a peer', false],
  ])(
    'holds every fan with the thumbs on the faces and nothing through a card, seen as %s',
    async (_view, firstPerson) => {
      const { scene, pose } = await loadCharacter(firstPerson);
      pose.look(0, 0);
      const rest = digitClearance(scene, 'R');
      for (const [count, aspect] of HANDS)
        for (const [yaw, pitch] of GAZE) {
          const label = `${count} cards, aspect ${aspect}, yaw ${yaw.toFixed(2)}`;
          const frame = viewFrame(pose, yaw, pitch);
          pose.pose({ yaw, pitch, reduced: true, count, half: fanHalfAngle(count, aspect), frame });
          const sample = skin(scene);
          const cards = fanCards(frame, count, aspect);
          expect(cardIntersections(sample, cards), label).toEqual([]);
          const sides = cardSides(sample, cards);
          for (const side of ['L', 'R'] as const) {
            if (side !== holdingHand(count)) continue;
            // Thumb pads rest on the faces; every other part stays behind the fan.
            const thumb = sides.get(`${side}:Thumb`);
            expect(thumb, `${label} ${side} thumb over a card`).toBeDefined();
            if (!thumb) continue;
            expect(thumb.front, label).toBeGreaterThan(0);
            expect(thumb.gap, label).toBeLessThan(0.03);
            for (const part of ['Palm', 'Index', 'Middle', 'Ring', 'Pinky'])
              expect(sides.get(`${side}:${part}`)?.front ?? 0, `${label} ${side} ${part}`).toBe(0);
            // Fingers keep their natural spacing: none folds into a neighbour.
            const clearance = digitClearance(scene, side);
            for (const [pair, distance] of Object.entries(clearance))
              if (!pair.startsWith('Thumb'))
                expect(distance, `${label} ${side} ${pair}`).toBeGreaterThan(rest[pair]! * 0.8);
          }
          expect(handGap(sample, scene), label).toBeGreaterThan(0.01);
        }
      if (firstPerson) scene.parent?.clear();
    },
    120000,
  );

  it('wraps the holding fingers around the fan without closing a fist', async () => {
    const { scene, pose } = await loadCharacter(false);
    pose.pose({ yaw: 0, pitch: 0, reduced: true, count: 5 });
    for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
      const joints = [1, 2, 3, 'Tip'].map((j) => at(scene, `${finger}${j}R`));
      const direct = joints[0]!.distanceTo(joints[3]!);
      const along = joints.slice(1).reduce((sum, p, i) => sum + p.distanceTo(joints[i]!), 0);
      expect(direct / along, finger).toBeGreaterThan(0.75);
      expect(direct / along, finger).toBeLessThan(0.98);
    }
  });

  it('preserves limb lengths in every pose', async () => {
    const { scene, pose } = await loadCharacter(false);
    pose.look(0, 0);
    const lengths = (side: string) => [
      at(scene, `UpperArm${side}`).distanceTo(at(scene, `LowerArm${side}`)),
      at(scene, `LowerArm${side}`).distanceTo(at(scene, `Hand${side}`)),
    ];
    const bind = { L: lengths('L'), R: lengths('R') };
    for (const id of Object.keys(EMOTES))
      for (const count of [0, 5]) {
        pose.pose({
          yaw: 0.4,
          pitch: 0.1,
          reduced: true,
          count,
          clips: [{ clip: EMOTES[id]!, time: 1000 }],
        });
        for (const side of ['L', 'R'] as const)
          lengths(side).forEach((length, i) =>
            expect(length, `${id} ${side}`).toBeCloseTo(bind[side][i]!, 5),
          );
      }
  });
});

describe('Character gestures', () => {
  it('names exactly the public gestures the server accepts', () => {
    expect(Object.keys(EMOTES).sort()).toEqual(GESTURES.map((g) => g.id).sort());
  });

  it('touches each face socket with the right hand while the fan stays held, as the head turns', async () => {
    const { scene, pose } = await loadCharacter(false);
    for (const yaw of [-LOOK_YAW_LIMIT, -0.5, 0, 0.5, LOOK_YAW_LIMIT])
      for (const [id, socket] of [
        ['nose', 'Nose'],
        ['ear-right', 'EarR'],
        ['ear-left', 'EarL'],
      ] as const) {
        // While holding cards, the free hand gestures; touching the right ear borrows the
        // right hand and the left takes the fan for the moment.
        const clip = FREE_HAND_EMOTES[id] ?? EMOTES[id]!;
        const side = clip.keys[0]!.R ? 'R' : 'L';
        const holder = holdingHand(5, side === 'R', side === 'L')!;
        const label = `${id} yaw ${yaw}`;
        const frame = viewFrame(pose, yaw, 0.1);
        pose.pose({ yaw, pitch: 0.1, reduced: true, count: 5, frame });
        const before = at(scene, `SocketGrip${holder}`);
        for (const time of [0, 100, 200, 300, 1000, 1800, 1950]) {
          pose.pose({ yaw, pitch: 0.1, reduced: false, count: 5, frame, clips: [{ clip, time }] });
          // Nothing passes through the fan at any moment, including the hand-over.
          expect(cardIntersections(skin(scene), fanCards(frame, 5)), `${label} ${time} ms`).toEqual(
            [],
          );
        }
        pose.pose({
          yaw,
          pitch: 0.1,
          reduced: true,
          count: 5,
          frame,
          clips: [{ clip, time: 1000 }],
        });
        expect(
          at(scene, `IndexTip${side}`).distanceTo(at(scene, `Socket${socket}`)),
          label,
        ).toBeLessThan(0.02);
        if (holder === 'R')
          expect(at(scene, 'SocketGripR').distanceTo(before), label).toBeLessThan(1e-4);
        else
          expect(
            cardSides(skin(scene), fanCards(frame, 5)).get('L:Thumb')?.gap,
            label,
          ).toBeLessThan(0.045);
      }
  }, 120000);

  it('shows distinct finger counts', async () => {
    const { scene, pose } = await loadCharacter(false);
    const reach: number[][] = [];
    for (const id of ['one', 'two', 'three', 'four']) {
      pose.pose({
        yaw: 0,
        pitch: 0,
        reduced: true,
        count: 5,
        clips: [{ clip: EMOTES[id]!, time: 1000 }],
      });
      reach.push(
        ['Index', 'Middle', 'Ring', 'Pinky'].map((finger) =>
          at(scene, `${finger}Tip${'R'}`).distanceTo(at(scene, 'HandR')),
        ),
      );
    }
    // Each count extends one more finger than the last.
    for (let i = 1; i < 4; i++) expect(reach[i]![i]! - reach[i - 1]![i]!).toBeGreaterThan(0.05);
  });
});

describe('Every emote and reaction', () => {
  const clips = [
    // Holding cards, hand-neutral emotes use the free left hand, as the rig does.
    ...Object.entries(EMOTES).map(([id, clip]) => [id, FREE_HAND_EMOTES[id] ?? clip, 5] as const),
    ...Object.entries(REACTIONS).map(
      ([id, clip]) =>
        [
          `reaction ${id}`,
          id === 'victory' ? clip : (FREE_HAND_EMOTES[id] ?? clip),
          id === 'victory' ? 0 : 5,
        ] as const,
    ),
  ];
  it.each(clips)(
    '%s keeps limbs whole, fingers apart and hands outside the head and the fan',
    async (_id, clip, count) => {
      const { scene, pose } = await loadCharacter(false);
      pose.look(0, 0);
      const rest = { L: digitClearance(scene, 'L'), R: digitClearance(scene, 'R') };
      const arm = (side: string) => [
        at(scene, `UpperArm${side}`).distanceTo(at(scene, `LowerArm${side}`)),
        at(scene, `LowerArm${side}`).distanceTo(at(scene, `Hand${side}`)),
      ];
      const bind = { L: arm('L'), R: arm('R') };
      const head = scene.getObjectByName('Head')!;
      for (let time = 0; time < clip.duration; time += clip.duration / 10) {
        const frame = viewFrame(pose, 0.3, 0);
        pose.pose({ yaw: 0.3, pitch: 0, reduced: false, count, frame, clips: [{ clip, time }] });
        const label = `${_id} at ${time.toFixed(0)} ms`;
        if (count)
          expect(cardIntersections(skin(scene), fanCards(frame, count)), label).toEqual([]);
        for (const side of ['L', 'R'] as const) {
          arm(side).forEach((length, i) => expect(length, label).toBeCloseTo(bind[side][i]!, 5));
          const clearance = digitClearance(scene, side);
          for (const pair of ['Index-Middle', 'Middle-Ring', 'Ring-Pinky'])
            expect(clearance[pair]!, `${label} ${side} ${pair}`).toBeGreaterThan(
              rest[side][pair]! * 0.8,
            );
        }
        // No hand skin inside the skull (an ellipsoid a little inside the head mesh).
        const toHead = head.matrixWorld.clone().invert();
        const sample = skin(scene);
        const inside = sample.positions.filter((p, i) => {
          if (!/:(Palm|Thumb|Index|Middle|Ring|Pinky)$/.test(sample.labels[i]!)) return false;
          const q = p.clone().applyMatrix4(toHead);
          const [cx, cy, cz] = SKULL.centre;
          const [rx, ry, rz] = SKULL.radii;
          return ((q.x - cx) / rx) ** 2 + ((q.y - cy) / ry) ** 2 + ((q.z - cz) / rz) ** 2 < 0.85;
        });
        expect(inside.length, label).toBe(0);
      }
    },
    120000,
  );
});

describe('Character card actions', () => {
  it.each(['play', 'pickup', 'draw'] as const)(
    '%s: the free hand reaches its target while the other keeps a clean grip',
    async (id) => {
      const { scene, pose } = await loadCharacter(false);
      // A table target well beyond reach, in front and to the right of the seat.
      const far = new THREE.Vector3(-0.3, 0.74, 1.2);
      const target = new THREE.Matrix4().makeTranslation(far.x, far.y, far.z);
      const targets = { table: target, deck: target };
      for (const count of [1, 5]) {
        // The right hand holds the fan; the free left hand acts.
        const acting = 'L';
        const holding = 'R';
        const clip = ACTIONS[id][acting];
        const frame = viewFrame(pose, 0, 0);
        pose.pose({ yaw: 0, pitch: 0, reduced: true, count, frame });
        const shoulder = at(scene, `UpperArm${acting}`);
        const restDistance = at(scene, `SocketPalm${acting}`).distanceTo(far);
        for (let time = 0; time < clip.duration; time += clip.duration / 10) {
          pose.pose({
            yaw: 0,
            pitch: 0,
            reduced: false,
            count,
            frame,
            clips: [{ clip, time, targets }],
          });
          const sample = skin(scene);
          const cards = fanCards(frame, count);
          const label = `${id}, ${count} cards, ${time.toFixed(0)} ms`;
          // The holding hand is untouched; any contact with the fan is the acting hand's.
          expect(
            cardIntersections(sample, cards).filter((hit) => hit.includes(`${holding}:`)),
            label,
          ).toEqual([]);
          expect(
            at(scene, `UpperArm${acting}`).distanceTo(at(scene, `LowerArm${acting}`)),
          ).toBeCloseTo(BODY.upperArm, 2);
        }
        // At its peak the palm has moved well toward the far target.
        pose.pose({
          yaw: 0,
          pitch: 0,
          reduced: false,
          count,
          frame,
          clips: [{ clip, time: clip.peak!, targets }],
        });
        const distance = at(scene, `SocketPalm${acting}`).distanceTo(far);
        expect(distance, `${id} ${count}`).toBeLessThan(restDistance - 0.12);
        expect(at(scene, `UpperArm${acting}`).distanceTo(shoulder)).toBeLessThan(0.1);
      }
    },
    120000,
  );
});

describe('Character runtime', () => {
  async function shippedScene() {
    const data = await readFile('public/models/character/base.glb');
    const binary = new ArrayBuffer(data.length);
    new Uint8Array(binary).set(data);
    return (await new GLTFLoader().parseAsync(binary, '')).scene;
  }

  it('keeps first-person anatomy fixed to the eyes when the viewport changes', async () => {
    setCharacterSource(shippedScene());
    const camera = new THREE.PerspectiveCamera(80, 1.6, 0.025, 70);
    const cards = new THREE.Group();
    camera.add(cards);
    cards.scale.setScalar(0.3);
    cards.position.set(0, -0.55, -0.85);
    cards.rotation.x = -0.1;
    const changed = vi.fn();
    const body = new FirstPersonCharacter('casual', changed, {
      camera,
      cards,
      look: () => ({ yaw: 0.5, pitch: 0.2 }),
    });
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    body.setCardCount(5);
    body.animate(0, true);
    const pad = body.root.getObjectByName('SocketGripR')!;
    const before = camera.worldToLocal(pad.getWorldPosition(new THREE.Vector3()));
    for (const aspect of [0.38, 0.46, 2.2]) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      body.animate(0, true);
      expect(
        camera.worldToLocal(pad.getWorldPosition(new THREE.Vector3())).distanceTo(before),
      ).toBeLessThan(1e-5);
      expect(body.root.scale.x).toBe(CHARACTER_SCALE);
    }
    // First person never draws its own head.
    expect(body.root.getObjectByName('HeadMesh')!.visible).toBe(false);
    body.dispose();
  });

  it.each(['seated', 'first person'])(
    'releases a %s character that finishes loading after its owner has gone',
    async (kind) => {
      let resolve!: (scene: THREE.Object3D) => void;
      setCharacterSource(new Promise((r) => (resolve = r)));
      const changed = vi.fn();
      const owner =
        kind === 'seated'
          ? new SeatedCharacter('copper', changed)
          : new FirstPersonCharacter('copper', changed);
      owner.dispose();
      const template = await shippedScene();
      resolve(template);
      await Promise.resolve();
      await Promise.resolve();
      expect(owner.root.children.filter((c) => c.name === 'Character')).toEqual([]);
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it('dresses each preset differently on the same rig', async () => {
    setCharacterSource(shippedScene());
    const changed = vi.fn();
    const copper = new SeatedCharacter('copper', changed);
    const sage = new SeatedCharacter('sage', changed);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
    const colours = (c: SeatedCharacter) =>
      Array.from(
        (c.root.getObjectByName('BodyMesh') as THREE.Mesh).geometry.getAttribute('color')
          .array as Float32Array,
      );
    expect(colours(copper)).not.toEqual(colours(sage));
    expect(copper.fan.visible).toBe(true);
    copper.dispose();
    sage.dispose();
  });
});
