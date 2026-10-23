import * as THREE from 'three';

/**
 * A card's pose in one frame: where it is, how it is turned, its (uniform) size and how far
 * it is bowed like a held card (0 flat on the table, 1 held).
 */
export interface CardPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
  bend: number;
}

export const clonePose = (pose: CardPose): CardPose => ({
  position: pose.position.clone(),
  quaternion: pose.quaternion.clone(),
  scale: pose.scale,
  bend: pose.bend,
});

export function samePose(a: CardPose, b: CardPose) {
  return (
    a.position.distanceToSquared(b.position) < 1e-10 &&
    Math.abs(a.quaternion.dot(b.quaternion)) > 1 - 1e-9 &&
    Math.abs(a.scale - b.scale) < 1e-6 &&
    Math.abs(a.bend - b.bend) < 1e-6
  );
}

/** Puts a mesh in `pose` within its parent's frame. */
export function applyPose(mesh: THREE.Mesh, pose: CardPose) {
  mesh.position.copy(pose.position);
  mesh.quaternion.copy(pose.quaternion);
  mesh.scale.setScalar(pose.scale);
  if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = pose.bend;
}

/** The pose a mesh has now within its parent's frame. */
export const meshPose = (mesh: THREE.Mesh): CardPose => ({
  position: mesh.position.clone(),
  quaternion: mesh.quaternion.clone(),
  scale: mesh.scale.x,
  bend: mesh.morphTargetInfluences?.[0] ?? 0,
});

/** A pose in `frame`'s space, seen in world space (frames are scaled uniformly). */
export function toWorld(pose: CardPose, frame: THREE.Object3D): CardPose {
  frame.updateWorldMatrix(true, false);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const size = new THREE.Vector3();
  new THREE.Matrix4()
    .compose(pose.position, pose.quaternion, new THREE.Vector3().setScalar(pose.scale))
    .premultiply(frame.matrixWorld)
    .decompose(position, quaternion, size);
  return { position, quaternion, scale: size.x, bend: pose.bend };
}

/** A direction (such as a velocity) in `frame`'s space, seen in world space, or back. */
export function directionToWorld(vector: THREE.Vector3, frame: THREE.Object3D, inverse = false) {
  frame.updateWorldMatrix(true, false);
  const quaternion = new THREE.Quaternion();
  const size = new THREE.Vector3();
  frame.matrixWorld.decompose(new THREE.Vector3(), quaternion, size);
  return inverse
    ? vector
        .clone()
        .applyQuaternion(quaternion.invert())
        .divideScalar(size.x || 1)
    : vector.clone().applyQuaternion(quaternion).multiplyScalar(size.x);
}

/** How long (ms) a card takes over `distance` world units: a nudge is quick, a crossing longer. */
export const travelTime = (distance: number) =>
  THREE.MathUtils.clamp(120 + 250 * Math.sqrt(distance), 120, 560);

/** Eased progress with no speed at either end. */
export const ease = (s: number) => s * s * (3 - 2 * s);

/**
 * A card in flight sets off from `from` at `velocity` (units per ms, the speed it already had)
 * and comes to rest on `to` after `duration`: a cubic Hermite, so its speed never jumps,
 * neither as it starts nor as it lands. A carried speed is limited so it never overshoots far.
 * `lift` raises the middle of the path, over other cards on the table.
 */
export function flightPoint(
  from: THREE.Vector3,
  velocity: THREE.Vector3,
  to: THREE.Vector3,
  duration: number,
  s: number,
  lift = 0,
) {
  const tangent = velocity.clone().multiplyScalar(duration);
  const limit = 2 * from.distanceTo(to) + 1e-3;
  if (tangent.length() > limit) tangent.setLength(limit);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  return from
    .clone()
    .multiplyScalar(h00)
    .addScaledVector(tangent, h10)
    .addScaledVector(to, h01)
    .setY(from.y * h00 + tangent.y * h10 + to.y * h01 + lift * 4 * s * (1 - s));
}
