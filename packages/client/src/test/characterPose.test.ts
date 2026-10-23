/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GESTURES, LOOK_PITCH_MAX, LOOK_PITCH_MIN, LOOK_YAW_LIMIT } from '@durak/shared';
import { ACTIONS, EMOTES, FREE_HAND_EMOTES, REACTIONS } from '../character/animations/registry';
import { holdingHand } from '../character/CharacterPose';
import { clipWeight, sidesOf, type Clip } from '../character/animation';
import { BODY, CARD_SIZE, SKULL } from '../character/spec';
import {
  FirstPersonCharacter,
  SeatedCharacter,
  setCharacterSource,
} from '../character/CharacterRig';
import {
  CHARACTER_SCALE,
  fanHalfAngle,
  TABLE_TOP,
  tableClearance,
} from '../components/three/CharacterSpace';
import {
  cardIntersections,
  cardSides,
  digitClearance,
  fanCards,
  handGap,
  loadCharacter,
  loadSeated,
  skin,
  tablePenetration,
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
// Centre, the corners and the half turns; looking down brings the fan over the free hand.
const GAZE = [
  [0, 0],
  [0, LOOK_PITCH_MIN],
  [0.6, 0],
  [-0.6, 0],
  [0.6, LOOK_PITCH_MIN],
  [-LOOK_YAW_LIMIT, LOOK_PITCH_MIN],
  [LOOK_YAW_LIMIT, LOOK_PITCH_MIN],
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
        pose.pose({ yaw: 0, pitch: 0, reduced: true, count, frame: viewFrame(pose, 0, 0) });
        const shoulder = at(scene, `UpperArm${acting}`);
        const restDistance = at(scene, `SocketPalm${acting}`).distanceTo(far);
        for (let time = 0; time < clip.duration; time += clip.duration / 10) {
          // The cards are drawn up while the hand acts, as the rig does.
          const frame = viewFrame(pose, 0, 0, clipWeight(clip, time));
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
          // The holding hand keeps its grip and the acting hand passes clear of the fan.
          expect(cardIntersections(sample, cards), `${label} (${holding} holds)`).toEqual([]);
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
          frame: viewFrame(pose, 0, 0, 1),
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

describe('Face touches', () => {
  it.each(['nose', 'ear-right', 'ear-left'])(
    '%s travels in front of the body, smoothly, with or without cards',
    async (id) => {
      const { body, scene, pose } = await loadSeated(Math.PI / 2);
      const toBody = body.matrixWorld.clone().invert();
      const local = (name: string) => at(scene, name).applyMatrix4(toBody);
      for (const count of [0, 5]) {
        const clip = (count && FREE_HAND_EMOTES[id]) || EMOTES[id]!;
        const side = sidesOf(clip)[0]!;
        let last: THREE.Vector3 | undefined;
        let lastElbow: THREE.Vector3 | undefined;
        // A right hand that first lets go of the fan starts from the cards, not the table,
        // so it may move a little faster.
        const lending = count > 0 && side === 'R';
        for (let time = 0; time <= clip.duration; time += 16) {
          const frame = viewFrame(pose, 0, 0);
          const clips = [{ clip, time }];
          pose.pose({
            yaw: 0,
            pitch: 0,
            reduced: false,
            count,
            frame,
            clips,
            table: tableClearance,
          });
          const label = `${id}, ${count} cards, ${time} ms`;
          // The wrist never swings behind the body, as it did when the route ran below the
          // fan beside the hip and bent the arm backward.
          expect(local(`Hand${side}`).z, label).toBeGreaterThan(0);
          // No whip: at most 6 cm a frame at 60 fps (8 cm when letting go of the fan).
          const tip = local(`IndexTip${side}`);
          if (last) expect(tip.distanceTo(last), label).toBeLessThan(lending ? 0.08 : 0.06);
          last = tip;
          // No elbow flip: it once jumped 19 cm in a frame where the reach lined up with
          // its fixed bend direction, wringing the forearm.
          const elbow = local(`LowerArm${side}`);
          if (lastElbow)
            expect(elbow.distanceTo(lastElbow), `${label} elbow`).toBeLessThan(
              lending ? 0.1 : 0.07,
            );
          lastElbow = elbow;
        }
      }
    },
    120000,
  );
});

describe('Character at the table', () => {
  // TableRenderer's layout: attack slots before the player, the pile's centre and the deck.
  const cm = (value: number) => (value * CHARACTER_SCALE) / 100;
  const card = (value: number) => cm(value * CARD_SIZE);
  const PLACES = {
    slots: [-2, 0, 2].map((k) => new THREE.Vector3(k * card(9.5), TABLE_TOP + cm(0.3), card(2))),
    centre: new THREE.Vector3(cm(2), TABLE_TOP + cm(3), -cm(4)),
    deck: new THREE.Vector3(-card(36), TABLE_TOP + cm(4), card(1)),
  };
  // The near chair (the local player's), one at the side and the far one; and a small body
  // (Buyna) at the near and side chairs.
  const SEATS = [
    [0, 1],
    [Math.PI / 2, 1],
    [Math.PI, 1],
    [0, 0.7],
    [Math.PI / 2, 0.7],
  ];

  it.each(SEATS)(
    'rests the hands on the table and holds every fan above it, from the chair at %f, size %f',
    async (angle, size) => {
      const { scene, pose } = await loadSeated(angle!, size);
      for (const count of [0, 1, 5, 7])
        for (const [yaw, pitch] of GAZE) {
          const label = `${count} cards, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}`;
          const frame = viewFrame(pose, yaw, pitch);
          const half = fanHalfAngle(count);
          pose.pose({ yaw, pitch, reduced: true, count, half, frame, table: tableClearance });
          const sample = skin(scene);
          expect(tablePenetration(sample), label).toEqual([]);
          if (!count) continue;
          // A fan raised clear of the table keeps a clean grip in its hand.
          frame.premultiply(new THREE.Matrix4().makeTranslation(0, pose.fanLift, 0));
          const cards = fanCards(frame, count);
          expect(cardIntersections(sample, cards), label).toEqual([]);
          expect(cardSides(sample, cards).get('R:Thumb')?.front ?? 0, label).toBeGreaterThan(0);
        }
    },
    120000,
  );

  it.each(SEATS)(
    'keeps hands out of the table through every emote and card action, from the chair at %f, size %f',
    async (angle, size) => {
      const { body, scene, pose } = await loadSeated(angle!, size);
      const rotation = body.getWorldQuaternion(new THREE.Quaternion());
      // Targets framed as the rig frames them: by the seat's facing and the body's scale.
      const at = (point: THREE.Vector3) =>
        new THREE.Matrix4().compose(
          point,
          rotation,
          new THREE.Vector3().setScalar(CHARACTER_SCALE * size!),
        );
      const runs: [string, Clip, number, Record<string, THREE.Matrix4>][] = [];
      for (const count of [0, 5]) {
        // The rig acts with the free left hand while the right holds cards.
        const side = count ? 'L' : 'R';
        PLACES.slots.forEach((slot, i) =>
          runs.push([`play ${i}`, ACTIONS.play[side], count, { table: at(slot) }]),
        );
        runs.push(['pickup', ACTIONS.pickup[side], count, { table: at(PLACES.centre) }]);
        runs.push(['draw', ACTIONS.draw[side], count, { deck: at(PLACES.deck) }]);
      }
      for (const [id, clip] of Object.entries(EMOTES)) {
        runs.push([id, clip, 0, {}]);
        runs.push([id, FREE_HAND_EMOTES[id] ?? clip, 5, {}]);
      }
      runs.push(['cry', FREE_HAND_EMOTES.cry!, 5, {}], ['victory', REACTIONS.victory, 0, {}]);
      for (const [id, clip, count, targets] of runs)
        for (let time = 0; time <= clip.duration; time += clip.duration / 12) {
          const frame = viewFrame(pose, 0.3, 0, clipWeight(clip, time));
          pose.pose({
            yaw: 0.3,
            pitch: 0,
            reduced: false,
            count,
            frame,
            clips: [{ clip, time, targets }],
            table: tableClearance,
          });
          const label = `${id}, ${count} cards, ${time.toFixed(0)} ms`;
          expect(tablePenetration(skin(scene)), label).toEqual([]);
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
