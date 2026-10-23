import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EMOTES, REACTIONS, ACTIONS } from '../character/animations/registry';
import { EXPRESSION, type Clip, type Expression } from '../character/animation';
import { REGIONS } from '../character/generate';
import { FACE, LID_TRAVEL } from '../character/spec';
import { loadCharacter } from './gripGeometry';

/** The posed head mesh in the Head joint's frame: each vertex's region and main bone. */
function face(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const mesh = scene.getObjectByName('HeadMesh') as THREE.SkinnedMesh;
  const toHead = scene.getObjectByName('Head')!.matrixWorld.clone().invert();
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const region = geometry.getAttribute('_region');
  const index = geometry.getAttribute('skinIndex');
  const weight = geometry.getAttribute('skinWeight');
  const points: { p: THREE.Vector3; region: string; bone: string }[] = [];
  for (let i = 0; i < position.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++)
      if (weight.getComponent(i, k) > weight.getComponent(i, best)) best = k;
    const p = mesh
      .applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(position, i))
      .applyMatrix4(mesh.matrixWorld)
      .applyMatrix4(toHead);
    points.push({
      p,
      region: REGIONS[region.getX(i)]!,
      bone: mesh.skeleton.bones[index.getComponent(i, best)]!.name,
    });
  }
  const triangles: number[][] = [];
  for (let i = 0; i < geometry.index!.count; i += 3)
    triangles.push([0, 1, 2].map((k) => geometry.index!.getX(i + k)));
  return { points, triangles };
}

/** Whether anything built on `bones` covers vertex `i` seen from straight ahead (+Z). */
function covered({ points, triangles }: ReturnType<typeof face>, i: number, bones: RegExp) {
  const origin = points[i]!.p.clone().add(new THREE.Vector3(0, 0, 1e-5));
  const ray = new THREE.Ray(origin, new THREE.Vector3(0, 0, 1));
  return triangles.some(
    (tri) =>
      !tri.includes(i) &&
      tri.every((k) => bones.test(points[k]!.bone)) &&
      ray.intersectTriangle(
        points[tri[0]!]!.p,
        points[tri[1]!]!.p,
        points[tri[2]!]!.p,
        false,
        new THREE.Vector3(),
      ) !== null,
  );
}

/** The region seen first looking straight back (-Z) at the face from in front of (x, y). */
function seen({ points, triangles }: ReturnType<typeof face>, x: number, y: number) {
  const ray = new THREE.Ray(new THREE.Vector3(x, y, 0.3), new THREE.Vector3(0, 0, -1));
  let nearest = Infinity;
  let region = '';
  const hit = new THREE.Vector3();
  for (const tri of triangles) {
    const [a, b, c] = tri.map((k) => points[k]!.p);
    if (!ray.intersectTriangle(a!, b!, c!, false, hit)) continue;
    const distance = hit.distanceTo(ray.origin);
    if (distance < nearest) [nearest, region] = [distance, points[tri[0]!]!.region];
  }
  return region;
}

const of = (shape: ReturnType<typeof face>, region: string, side?: string) =>
  shape.points
    .map((point, i) => ({ ...point, i }))
    .filter((point) => point.region === region && (!side || point.bone.endsWith(side)));

describe('Character face', () => {
  it('opens the eyes at rest and shuts every iris behind the lids', async () => {
    const { scene, pose } = await loadCharacter(false);
    pose.pose({ yaw: 0, pitch: 0, reduced: true, count: 0 });
    let shape = face(scene);
    for (const side of ['L', 'R']) {
      const pupil = of(shape, 'pupil', side);
      expect(pupil.length).toBeGreaterThan(0);
      expect(
        pupil.filter(({ i }) => covered(shape, i, /^Lid/)),
        side,
      ).toEqual([]);
    }
    pose.pose({ yaw: 0, pitch: 0, reduced: true, count: 0, face: { squint: 1 } });
    shape = face(scene);
    for (const side of ['L', 'R']) {
      const iris = [...of(shape, 'iris', side), ...of(shape, 'pupil', side)];
      // Only the iris's rim may sit beside the lid, sunk in the skin of the face.
      const open = iris.filter(({ i }) => !covered(shape, i, /^Lid/));
      expect(open.length / iris.length, side).toBeLessThan(0.1);
      expect(of(shape, 'pupil', side).filter(({ i }) => !covered(shape, i, /^Lid/))).toEqual([]);
    }
  });

  it('keeps the pupils on the eyeball wherever the eyes look', async () => {
    const { scene, pose } = await loadCharacter(false);
    for (const gazeX of [-1, 0, 1])
      for (const gazeY of [-1, 0, 1]) {
        pose.pose({ yaw: 0, pitch: 0, reduced: true, count: 0, face: { gazeX, gazeY } });
        const shape = face(scene);
        for (const side of ['L', 'R']) {
          const pupil = of(shape, 'pupil', side);
          const centre = pupil.reduce((sum, { p }) => sum.add(p), new THREE.Vector3());
          centre.divideScalar(pupil.length);
          const [x, y] = FACE.eye;
          const [rx, ry] = FACE.eyeRadii;
          const across = (centre.x - (side === 'L' ? x : -x)) / rx;
          const up = (centre.y - y) / ry;
          expect(across ** 2 + up ** 2, `${side} ${gazeX},${gazeY}`).toBeLessThan(0.5);
          // The eyes turn the way they are told.
          if (gazeX) expect(Math.sign(across)).toBe(gazeX);
          if (gazeY) expect(Math.sign(up)).toBe(gazeY);
        }
      }
  });

  it('smiles, frowns and opens the mouth', async () => {
    const { scene, pose } = await loadCharacter(false);
    const mouth = (expression: Expression) => {
      pose.pose({ yaw: 0, pitch: 0, reduced: true, count: 0, face: expression });
      const shape = face(scene);
      const lips = of(shape, 'lip');
      const corner = lips.filter(({ p }) => Math.abs(p.x) > FACE.mouthHalfWidth * 0.8);
      const middle = lips.filter(({ p }) => Math.abs(p.x) < FACE.mouthHalfWidth * 0.2);
      const height = (points: typeof lips) =>
        points.reduce((sum, { p }) => sum + p.y, 0) / points.length;
      return {
        // Corners relative to the middle of the lips, in millimetres.
        corners: (height(corner) - height(middle)) * 1000,
        lowest: Math.min(...lips.map(({ p }) => p.y)) * 1000,
        // How much of the mouth's interior shows, on a 1 mm grid over the lips.
        inside: Array.from({ length: 31 * 31 }, (_, k) =>
          seen(shape, ((k % 31) - 15) * 0.001, FACE.mouth[1] + (Math.floor(k / 31) - 25) * 0.001),
        ).filter((region) => region === 'mouth').length,
        where: Array.from({ length: 31 * 31 }, (_, k) => [
          (k % 31) - 15,
          Math.floor(k / 31) - 25,
          seen(shape, ((k % 31) - 15) * 0.001, FACE.mouth[1] + (Math.floor(k / 31) - 25) * 0.001),
        ])
          .filter(([, , r]) => r === 'mouth')
          .map(([x, y]) => `${x},${y}`)
          .join(' '),
      };
    };
    // A faint smile at rest, so it does not look stern.
    const rest = mouth({ smile: -0.12 });
    expect(mouth({}).corners).toBeGreaterThan(rest.corners);
    expect(mouth({ smile: 1 }).corners).toBeGreaterThan(rest.corners + 3);
    expect(mouth({ smile: -1 }).corners).toBeLessThan(rest.corners - 3);
    const open = mouth({ open: 1 });
    expect(open.lowest).toBeLessThan(rest.lowest - 6);
    expect(rest.inside, rest.where).toBe(0);
    expect(open.inside).toBeGreaterThan(5);
  });

  it('blinks every few seconds, briefly, each body on its own rhythm', async () => {
    const lids = async () => {
      const { scene, pose } = await loadCharacter(false);
      const lid = scene.getObjectByName('LidL')!;
      const closed: boolean[] = [];
      for (let ms = 0; ms < 30000; ms += 20) {
        pose.pose({ yaw: 0, pitch: 0, reduced: false, count: 0, motion: { time: ms } });
        // The rest look is a little down, which lowers the lids a touch: shut is past 80%.
        closed.push(2 * Math.acos(Math.min(1, lid.quaternion.w)) > 0.8 * LID_TRAVEL);
      }
      return closed;
    };
    const a = await lids();
    const blinks = a.filter((shut, i) => shut && !a[i - 1]).length;
    expect(blinks).toBeGreaterThanOrEqual(5);
    expect(blinks).toBeLessThanOrEqual(16);
    // No blink holds the eyes shut longer than about a tenth of a second.
    let run = 0;
    for (const shut of a) {
      run = shut ? run + 1 : 0;
      expect(run * 20).toBeLessThanOrEqual(140);
    }
    const b = await lids();
    expect(b).not.toEqual(a);
  });

  it('keeps every clip expression within the face rig range', () => {
    const clips: Clip[] = [
      ...Object.values(EMOTES),
      ...Object.values(REACTIONS),
      ...Object.values(ACTIONS).flatMap((pair) => [pair.L, pair.R]),
    ];
    for (const clip of clips)
      for (const key of clip.keys)
        for (const name of EXPRESSION) {
          const value = key.face?.[name] ?? 0;
          expect(Math.abs(value)).toBeLessThanOrEqual(1);
          if (name === 'open' || name === 'squint') expect(value).toBeGreaterThanOrEqual(0);
        }
  });
});
