/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  GESTURES,
  gestureWeight,
  LOOK_YAW_LIMIT,
  LOOK_PITCH_MIN,
  LOOK_PITCH_MAX,
} from '@durak/shared';
import { CasualPose } from '../components/three/CasualPose';
import { CasualAvatar, makeCasualHands, disposeCharacter } from '../components/three/CasualAvatar';
import {
  CASUAL_FACE,
  CHARACTER_SCALE,
  CHARACTER_FLOOR,
  SEAT_RADIUS_Z,
  carryMatrix,
  gripPoint,
} from '../components/three/CharacterSpace';

async function fixture(firstPerson = false) {
  const data = await readFile(`public/models/casual/${firstPerson ? 'arms' : 'casual'}.glb`);
  const binary = new ArrayBuffer(data.length);
  new Uint8Array(binary).set(data);
  const { scene } = await new GLTFLoader().parseAsync(binary, '');
  const pose = new CasualPose(scene, firstPerson);
  const at = (name: string) => scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
  return { scene, pose, at };
}
const gesture = (id: string) => ({ gestureId: id, gestureStartedAt: 1000 });
afterEach(() => vi.restoreAllMocks());

describe('Casual model skeletal poses', () => {
  it('keeps first-person contact at the camera face and the supporting wrist on the fan through combined gaze limits', async () => {
    const { scene, pose, at } = await fixture(true);
    const body = new THREE.Group();
    body.position.set(0, CHARACTER_FLOOR, SEAT_RADIUS_Z);
    body.rotation.y = Math.PI;
    body.scale.setScalar(CHARACTER_SCALE);
    body.add(scene);
    const camera = new THREE.PerspectiveCamera(80, 1.6, 0.025, 70);
    for (const yaw of [-LOOK_YAW_LIMIT, 0, LOOK_YAW_LIMIT])
      for (const pitch of [LOOK_PITCH_MIN, 0, LOOK_PITCH_MAX]) {
        pose.prepareHead(yaw, pitch);
        const view = pose.view();
        camera.position.copy(view.position);
        camera.quaternion.copy(view.quaternion);
        camera.updateMatrixWorld(true);
        const frame = carryMatrix(view);
        for (const id of ['nose', 'ear-left', 'ear-right'] as const) {
          pose.pose(yaw, pitch, gesture(id), 1500, true, 5, frame);
          const side = id === 'ear-left' ? 'L' : 'R';
          const supporting = side === 'L' ? 'R' : 'L';
          const fingertip = scene
            .getObjectByName(`Index4${side}`)!
            .children[0]!.getWorldPosition(new THREE.Vector3());
          const inCamera = camera.worldToLocal(fingertip);
          const expected = CASUAL_FACE[id]
            .clone()
            .sub(CASUAL_FACE.eyes)
            .multiplyScalar(CHARACTER_SCALE)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
          expect(inCamera.distanceTo(expected), `${id}, yaw ${yaw}, pitch ${pitch}`).toBeLessThan(
            0.025,
          );
          expect(
            at(`Hand${supporting}`).distanceTo(gripPoint(supporting, 5).applyMatrix4(frame)),
            `support ${id}, ${yaw}, ${pitch}`,
          ).toBeLessThan(0.005);
        }
      }
    disposeCharacter(scene);
  });

  it('keeps real first-person anatomy fixed when the camera viewport changes', async () => {
    const { scene } = await fixture(true);
    let loaded: ((result: { scene: THREE.Group }) => void) | undefined;
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation((_url, success) => {
      loaded = success as typeof loaded;
    });
    const camera = new THREE.PerspectiveCamera(80, 1.6, 0.025, 70);
    const cards = new THREE.Group();
    camera.add(cards);
    cards.scale.setScalar(0.3);
    cards.position.set(0, -0.55, -0.85);
    cards.rotation.x = -0.1;
    const hands = makeCasualHands(vi.fn(), {
      camera,
      cards,
      look: () => ({ yaw: 0.5, pitch: 0.2 }),
    });
    loaded!({ scene });
    hands.setCardCount(5);
    const started = Date.now();
    hands.setGesture({ gestureId: 'nose', gestureStartedAt: started });
    hands.animate(0, true);
    const fingertip = scene.getObjectByName('Index4R')!.children[0]!;
    const before = camera.worldToLocal(fingertip.getWorldPosition(new THREE.Vector3()));
    for (const aspect of [0.38, 0.46, 2.2]) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      hands.setCardCount(5);
      hands.animate(0, true);
      expect(
        camera.worldToLocal(fingertip.getWorldPosition(new THREE.Vector3())).distanceTo(before),
      ).toBeLessThan(0.00001);
      expect(hands.root.scale.x).toBe(CHARACTER_SCALE);
    }
    expect(Math.abs(before.z)).toBeLessThan(0.12);
    expect(before.y).toBeLessThan(-0.1);
    hands.dispose();
  });
  it('exports one bone hierarchy with normalized weights for every modular part', async () => {
    const { scene } = await fixture();
    const names = new Set<string>();
    let triangles = 0;
    scene.traverse((node) => {
      if (node instanceof THREE.Bone) {
        expect(names.has(node.name), node.name).toBe(false);
        names.add(node.name);
      }
      if (!(node instanceof THREE.SkinnedMesh)) return;
      triangles += node.geometry.index!.count / 3;
      const weights = node.geometry.getAttribute('skinWeight');
      for (let i = 0; i < weights.count; i++)
        expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(
          1,
          4,
        );
    });
    expect(triangles).toBe(6206);
    expect(names.has('Index4L')).toBe(true);
    disposeCharacter(scene);
  });
  it('preserves limb lengths, leaves the supporting hand in its grip and produces distinct finger counts', async () => {
    const { scene, pose, at } = await fixture();
    pose.pose(0, 0, {}, 1500, false);
    const supporting = at('HandL');
    const upperLength = at('UpperArmR').distanceTo(at('LowerArmR'));
    const lowerLength = at('LowerArmR').distanceTo(at('HandR'));
    const reaches: number[][] = [];
    for (const id of ['one', 'two', 'three', 'four']) {
      pose.pose(0, 0, gesture(id), 1500, false);
      expect(at('HandL').distanceTo(supporting)).toBeLessThan(0.0001);
      expect(at('UpperArmR').distanceTo(at('LowerArmR'))).toBeCloseTo(upperLength, 4);
      expect(at('LowerArmR').distanceTo(at('HandR'))).toBeCloseTo(lowerLength, 4);
      reaches.push(
        ['Index', 'Middle', 'Ring', 'Pinky'].map((finger) => at(`${finger}4R`).y - at('HandR').y),
      );
    }
    for (let i = 1; i < 4; i++) expect(reaches[i]![i]! - reaches[i - 1]![i]!).toBeGreaterThan(0.1);
    disposeCharacter(scene);
  });

  it('keeps index contact on the head as gaze changes, without moving the other hand', async () => {
    const { scene, pose, at } = await fixture();
    for (const yaw of [-0.5, 0, 0.5])
      for (const id of ['nose', 'ear-left', 'ear-right']) {
        pose.pose(yaw, 0.15, {}, 1500, false);
        const side = id === 'ear-left' ? 'L' : 'R';
        const other = side === 'L' ? 'R' : 'L';
        const supporting = at(`Hand${other}`);
        pose.pose(yaw, 0.15, gesture(id), 1500, false);
        const head = scene.getObjectByName('Head')!;
        const anchor = CASUAL_FACE[id as 'nose' | 'ear-left' | 'ear-right']
          .clone()
          .applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()))
          .add(at('Head'));
        const tip = scene.getObjectByName(`Index4${side}`)!.children[0]!;
        expect(
          tip.getWorldPosition(new THREE.Vector3()).distanceTo(anchor),
          `${id} yaw ${yaw}`,
        ).toBeLessThan(0.04);
        expect(at(`Hand${other}`).distanceTo(supporting)).toBeLessThan(0.0001);
      }
    disposeCharacter(scene);
  });

  it('does not restart expired gestures and makes reduced-motion poses static', () => {
    for (const { id } of GESTURES) {
      expect(gestureWeight(gesture(id), 999)).toBe(0);
      expect(gestureWeight(gesture(id), 1001, true)).toBe(1);
      expect(gestureWeight(gesture(id), 1500)).toBe(1);
      expect(gestureWeight(gesture(id), 3000)).toBe(0);
    }
  });

  it.each(['peer', 'hands'])(
    'disposes a late %s asset result after its owner has gone',
    async (kind) => {
      const { scene } = await fixture();
      let loaded: ((result: { scene: THREE.Group }) => void) | undefined;
      const request = vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation((_url, success) => {
        loaded = success as typeof loaded;
      });
      const changed = vi.fn();
      const owner = kind === 'peer' ? new CasualAvatar(changed) : makeCasualHands(changed);
      let mesh: THREE.SkinnedMesh | undefined;
      scene.traverse((node) => {
        if (node instanceof THREE.SkinnedMesh) mesh ??= node;
      });
      const releaseGeometry = vi.spyOn(mesh!.geometry, 'dispose');
      const releaseSkeleton = vi.spyOn(mesh!.skeleton, 'dispose');
      owner.dispose();
      loaded!({ scene });
      expect(releaseGeometry).toHaveBeenCalledOnce();
      expect(releaseSkeleton).toHaveBeenCalledOnce();
      expect(scene.parent).toBeNull();
      expect(changed).not.toHaveBeenCalled();
      request.mockRestore();
    },
  );
});
