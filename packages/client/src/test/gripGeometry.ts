/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterPose } from '../character/CharacterPose';
import {
  CHARACTER_FLOOR,
  CHARACTER_SCALE,
  HELD_CARD_SCALE,
  SEAT_RADIUS_Z,
  carryMatrix,
  CARRY_RAISE,
  CARRY_Y,
  fanStep,
  heldCard,
} from '../components/three/CharacterSpace';

/** Measurements of the shipped character mesh against the held fan, in carry-frame units. */

// Held card geometry before its mesh scale: RoundedBox 0.82 x 0.035 x 1.2, flattened to
// 35% thickness and bowed toward the face by 0.025 at both short ends.
const HALF_WIDTH = 0.41;
const HALF_HEIGHT = 0.6;
const HALF_THICKNESS = (0.035 * 0.35) / 2;
const bow = (z: number) => 0.025 * (z / HALF_HEIGHT) ** 2;
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;

/**
 * The shipped character, placed in the local chair (first person) or alone at unit
 * scale (a peer's rig before the table scales it).
 */
export async function loadCharacter(firstPerson: boolean) {
  const data = await readFile('public/models/character/base.glb');
  const binary = new ArrayBuffer(data.length);
  new Uint8Array(binary).set(data);
  const { scene } = await new GLTFLoader().parseAsync(binary, '');
  if (firstPerson) {
    const body = new THREE.Group();
    body.position.set(0, CHARACTER_FLOOR, SEAT_RADIUS_Z);
    body.rotation.y = Math.PI;
    body.scale.setScalar(CHARACTER_SCALE);
    body.add(scene);
  }
  return { scene, pose: new CharacterPose(scene) };
}

/** World matrices of the held cards, laid out exactly like TableRenderer. */
export function fanCards(frame: THREE.Matrix4, count: number, aspect = Infinity, raised = -1) {
  const step = fanStep(count, aspect);
  return Array.from({ length: count }, (_, i) => {
    const { angle, position } = heldCard(i, count, step, i === raised);
    const local = new THREE.Matrix4().compose(
      position,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -angle, 'ZYX')),
      new THREE.Vector3().setScalar(HELD_CARD_SCALE),
    );
    return frame.clone().multiply(local);
  });
}

type Skin = { positions: THREE.Vector3[]; labels: string[]; triangles: number[] };

/** Posed skin vertices labelled by their dominant bone, e.g. "Index3R" -> "R:Index". */
export function skin(scene: THREE.Object3D): Skin {
  scene.updateMatrixWorld(true);
  const positions: THREE.Vector3[] = [];
  const labels: string[] = [];
  const triangles: number[] = [];
  const bases = new Map<THREE.BufferAttribute | THREE.InterleavedBufferAttribute, number>();
  scene.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const geometry = node.geometry;
    const attribute = geometry.getAttribute('position');
    let base = bases.get(attribute);
    if (base === undefined) {
      base = positions.length;
      bases.set(attribute, base);
      const index = geometry.getAttribute('skinIndex');
      const weight = geometry.getAttribute('skinWeight');
      for (let i = 0; i < attribute.count; i++) {
        let best = 0;
        let bone = 0;
        for (let k = 0; k < 4; k++)
          if (weight.getComponent(i, k) > best) {
            best = weight.getComponent(i, k);
            bone = index.getComponent(i, k);
          }
        const name = node.skeleton.bones[bone]!.name;
        const finger = FINGERS.find((f) => name.startsWith(f));
        const side = /[LR]$/.test(name) ? name.slice(-1) : '';
        labels.push(
          `${side}:${finger ?? (name.startsWith('Hand') ? 'Palm' : name.startsWith('LowerArm') ? 'Forearm' : 'Body')}`,
        );
        const p = node.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(attribute, i));
        positions.push(p.applyMatrix4(node.matrixWorld));
      }
    }
    const order = geometry.index;
    if (!order) return;
    for (let i = 0; i < order.count; i++) triangles.push(base + order.getX(i));
  });
  return { positions, labels, triangles };
}

const isHand = (label: string) =>
  /:(Palm|Thumb|Index|Middle|Ring|Pinky)$/.test(label) || label.endsWith('Forearm');

function segmentHitsTriangle(
  origin: THREE.Vector3,
  end: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  const direction = end.clone().sub(origin);
  const e1 = b.clone().sub(a);
  const e2 = c.clone().sub(a);
  const p = direction.clone().cross(e2);
  const det = e1.dot(p);
  if (Math.abs(det) < 1e-12) return false;
  const s = origin.clone().sub(a);
  const u = s.dot(p) / det;
  if (u < 0 || u > 1) return false;
  const q = s.cross(e1);
  const v = direction.dot(q) / det;
  if (v < 0 || u + v > 1) return false;
  const t = e2.dot(q) / det;
  return t >= 0 && t <= 1;
}

/**
 * Every place the hand mesh passes through a card, including a clearance margin.
 * A skin edge crossing either offset surface of a card inside its outline is a hit,
 * as is a card outline edge passing through a skin triangle. Thumb pads rest on the
 * face by design, so the thumb's margin only allows for that touch.
 */
export function cardIntersections(sample: Skin, cards: THREE.Matrix4[], margin = 0.01) {
  const hits: string[] = [];
  const levelFor = (label: string) => HALF_THICKNESS + (label.endsWith(':Thumb') ? 0.001 : margin);
  const inside = (p: THREE.Vector3) => Math.abs(p.x) <= HALF_WIDTH && Math.abs(p.z) <= HALF_HEIGHT;
  cards.forEach((card, c) => {
    const inverse = card.clone().invert();
    const local = sample.positions.map((p) => p.clone().applyMatrix4(inverse));
    const offset = local.map((p) => p.y - bow(p.z));
    const record = (label: string) => {
      const key = `card ${c}: ${label}`;
      if (!hits.includes(key)) hits.push(key);
    };
    for (let t = 0; t < sample.triangles.length; t += 3) {
      const ids = [sample.triangles[t]!, sample.triangles[t + 1]!, sample.triangles[t + 2]!];
      const label = sample.labels[ids[0]!]!;
      if (!isHand(label)) continue;
      for (let e = 0; e < 3; e++) {
        const i = ids[e]!;
        const j = ids[(e + 1) % 3]!;
        const level = levelFor(label);
        if (Math.abs(offset[i]!) < level && inside(local[i]!)) record(sample.labels[i]!);
        for (const surface of [-level, level]) {
          const di = offset[i]! - surface;
          const dj = offset[j]! - surface;
          if (di * dj >= 0) continue;
          const crossing = local[i]!.clone().lerp(local[j]!, di / (di - dj));
          if (inside(crossing)) record(label);
        }
      }
    }
    // The outline of the card against skin triangles catches corners poking into a palm.
    const corners = [
      [-HALF_WIDTH, -HALF_HEIGHT],
      [HALF_WIDTH, -HALF_HEIGHT],
      [HALF_WIDTH, HALF_HEIGHT],
      [-HALF_WIDTH, HALF_HEIGHT],
    ].map(([x, z]) => new THREE.Vector3(x, bow(z!), z));
    for (let k = 0; k < 4; k++) {
      const start = corners[k]!;
      const end = corners[(k + 1) % 4]!;
      for (let t = 0; t < sample.triangles.length; t += 3) {
        const label = sample.labels[sample.triangles[t]!]!;
        if (!isHand(label)) continue;
        if (
          segmentHitsTriangle(
            start,
            end,
            local[sample.triangles[t]!]!,
            local[sample.triangles[t + 1]!]!,
            local[sample.triangles[t + 2]!]!,
          )
        )
          record(`${label} (card edge)`);
      }
    }
  });
  return hits;
}

/** Which side of each card the skin of every part lies on, where it overlaps the card. */
export function cardSides(sample: Skin, cards: THREE.Matrix4[]) {
  const sides = new Map<string, { front: number; back: number; gap: number }>();
  cards.forEach((card) => {
    const inverse = card.clone().invert();
    sample.positions.forEach((p, i) => {
      const label = sample.labels[i]!;
      if (!isHand(label)) return;
      const local = p.clone().applyMatrix4(inverse);
      if (Math.abs(local.x) > HALF_WIDTH || Math.abs(local.z) > HALF_HEIGHT) return;
      const d = local.y - bow(local.z);
      const entry = sides.get(label) ?? { front: 0, back: 0, gap: Infinity };
      if (d > 0) entry.front++;
      else entry.back++;
      // Distance from the skin to the nearer card surface, in carry-frame units.
      entry.gap = Math.min(entry.gap, (Math.abs(d) - HALF_THICKNESS) * HELD_CARD_SCALE);
      sides.set(label, entry);
    });
  });
  return sides;
}

export function bonePath(scene: THREE.Object3D, finger: string, side: string) {
  return [1, 2, 3, 'Tip'].map((j) =>
    scene.getObjectByName(`${finger}${j}${side}`)!.getWorldPosition(new THREE.Vector3()),
  );
}

function segmentDistance(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3,
) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  new THREE.Line3(p1, q1).closestPointToPoint(p2, true, a);
  let best = Infinity;
  // Sampled closest approach; segments are short, so 24 samples are ample.
  for (let i = 0; i <= 24; i++) {
    const point = p1.clone().lerp(q1, i / 24);
    new THREE.Line3(p2, q2).closestPointToPoint(point, true, b);
    best = Math.min(best, point.distanceTo(b));
  }
  return best;
}

export function pathDistance(a: THREE.Vector3[], b: THREE.Vector3[]) {
  let best = Infinity;
  for (let i = 0; i + 1 < a.length; i++)
    for (let j = 0; j + 1 < b.length; j++)
      best = Math.min(best, segmentDistance(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!));
  return best;
}

/** Closest approach between each pair of digits on one hand, in character units. */
export function digitClearance(scene: THREE.Object3D, side: string) {
  const scale = scene.getWorldScale(new THREE.Vector3()).x;
  const paths = Object.fromEntries(FINGERS.map((f) => [f, bonePath(scene, f, side)]));
  const result: Record<string, number> = {};
  for (let i = 0; i < FINGERS.length; i++)
    for (let j = i + 1; j < FINGERS.length; j++)
      result[`${FINGERS[i]}-${FINGERS[j]}`] =
        pathDistance(paths[FINGERS[i]!]!, paths[FINGERS[j]!]!) / scale;
  return result;
}

/** Bend at each finger joint (radians); 0 is a straight finger. */
export function jointBends(scene: THREE.Object3D, side: string) {
  const result: Record<string, number[]> = {};
  for (const finger of FINGERS) {
    const hand = scene.getObjectByName(`Hand${side}`)!.getWorldPosition(new THREE.Vector3());
    const path = [hand, ...bonePath(scene, finger, side)];
    const bends: number[] = [];
    for (let i = 1; i + 1 < path.length; i++)
      bends.push(
        path[i]!.clone()
          .sub(path[i - 1]!)
          .angleTo(path[i + 1]!.clone().sub(path[i]!)),
      );
    // The palm segment to a knuckle is not a joint of the finger itself.
    result[finger] = bends.slice(1);
  }
  return result;
}

/** Closest approach between the two hands' skins, in character units. */
export function handGap(sample: Skin, scene: THREE.Object3D) {
  const scale = scene.getWorldScale(new THREE.Vector3()).x;
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  sample.positions.forEach((p, i) => {
    const label = sample.labels[i]!;
    if (!/:(Palm|Thumb|Index|Middle|Ring|Pinky)$/.test(label)) return;
    (label.startsWith('L') ? left : right).push(p);
  });
  let best = Infinity;
  for (let i = 0; i < left.length; i += 2)
    for (let j = 0; j < right.length; j += 2) best = Math.min(best, left[i]!.distanceTo(right[j]!));
  return best / scale;
}

/** The carry frame each view holds its cards in, drawn up by `raised` (0 to 1). */
export function viewFrame(pose: CharacterPose, yaw: number, pitch: number, raised = 0) {
  pose.look(yaw, pitch);
  return carryMatrix(
    pose.view(),
    CARRY_Y + CARRY_RAISE * raised,
    pose.root.getWorldScale(new THREE.Vector3()).x,
  );
}
