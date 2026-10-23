/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FINGERS,
  HAND,
  SIDES,
  SKELETON,
  SOCKETS,
} from '../character/spec';
import { generateCharacter, HAIR_STYLES, REGIONS } from '../character/generate';

async function shipped() {
  const data = await readFile('public/models/character/base.glb');
  const binary = new ArrayBuffer(data.length);
  new Uint8Array(binary).set(data);
  return (await new GLTFLoader().parseAsync(binary, '')).scene;
}
const position = (scene: THREE.Object3D, name: string) =>
  scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

describe('Durak character contract', () => {
  it('ships every contract bone once, with the contract hierarchy', async () => {
    const scene = await shipped();
    const bones = new Map<string, THREE.Bone>();
    scene.traverse((node) => {
      if (!(node instanceof THREE.Bone)) return;
      expect(bones.has(node.name), node.name).toBe(false);
      bones.set(node.name, node);
    });
    for (const joint of SKELETON) {
      const bone = bones.get(joint.name);
      expect(bone, joint.name).toBeDefined();
      if (joint.parent) expect(bone!.parent?.name, joint.name).toBe(joint.parent);
      // Seated bind positions, so the camera and fan do not move.
      expect(position(scene, joint.name).distanceTo(new THREE.Vector3(...joint.at))).toBeLessThan(
        1e-4,
      );
    }
    for (const [name, socket] of Object.entries(SOCKETS))
      expect(scene.getObjectByName(`Socket${name}`)?.parent?.name, name).toBe(socket.bone);
  });

  it('gives real adult hands next to a real card, with an opposable three-bone thumb', async () => {
    const scene = await shipped();
    for (const side of SIDES) {
      const palm = position(scene, `Hand${side}`).distanceTo(position(scene, `Middle1${side}`));
      // A 10.8 cm palm beside an 8.9 cm card.
      expect(palm / CARD_HEIGHT).toBeGreaterThan(1.1);
      expect(palm / CARD_HEIGHT).toBeLessThan(1.35);
      for (const finger of FINGERS) {
        const length = position(scene, `${finger}1${side}`).distanceTo(
          position(scene, `${finger}Tip${side}`),
        );
        expect(length, finger).toBeLessThan(CARD_HEIGHT);
      }
      const thumb = [1, 2, 3].map((i) => scene.getObjectByName(`Thumb${i}${side}`));
      expect(thumb.every(Boolean)).toBe(true);
      // Four fingers side by side span about 8 cm: a quarter wider than a card.
      const span = position(scene, `Index1${side}`).distanceTo(position(scene, `Pinky1${side}`));
      expect((span + 2 * HAND.fingerRadius) / CARD_WIDTH).toBeGreaterThan(1.1);
      expect((span + 2 * HAND.fingerRadius) / CARD_WIDTH).toBeLessThan(1.45);
    }
  });

  it('skins every vertex with normalized weights and tags its appearance region', async () => {
    const scene = await shipped();
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) meshes.push(node);
    });
    expect(meshes.map((m) => m.name).sort()).toEqual(
      ['BodyMesh', 'HeadMesh', ...Array.from({ length: HAIR_STYLES }, (_, i) => `Hair${i}`)].sort(),
    );
    for (const mesh of meshes) {
      const weights = mesh.geometry.getAttribute('skinWeight');
      const region = mesh.geometry.getAttribute('_region');
      expect(region, mesh.name).toBeDefined();
      for (let i = 0; i < weights.count; i++) {
        expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(
          1,
          4,
        );
        expect(region.getX(i)).toBeGreaterThanOrEqual(0);
        expect(region.getX(i)).toBeLessThan(REGIONS.length);
      }
    }
    const visible = meshes
      .filter((m) => m.name === 'BodyMesh' || m.name === 'HeadMesh' || m.name === 'Hair0')
      .reduce((sum, m) => sum + m.geometry.index!.count / 3, 0);
    expect(visible).toBeLessThan(7000);
  });

  it('matches the generator, so the shipped asset is never stale', async () => {
    const scene = await shipped();
    const fresh = generateCharacter();
    for (const name of ['BodyMesh', 'HeadMesh', 'Hair0']) {
      const a = (scene.getObjectByName(name) as THREE.Mesh).geometry;
      const b = (fresh.getObjectByName(name) as THREE.Mesh).geometry;
      expect(a.getAttribute('position').count, name).toBe(b.getAttribute('position').count);
      expect(a.index!.count, name).toBe(b.index!.count);
    }
  });
});
