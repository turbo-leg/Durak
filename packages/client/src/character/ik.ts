import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const world = (node: THREE.Object3D) => node.getWorldPosition(V());

/** Set a node's world rotation, keeping its children attached. */
export function worldRotation(node: THREE.Object3D, rotation: THREE.Quaternion) {
  const parent = node.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  node.quaternion.copy(parent.invert().multiply(rotation));
  node.updateWorldMatrix(false, true);
}

/** Turn `node` so the direction toward `child` points at `target`. */
export function aim(node: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  const origin = world(node);
  const from = world(child).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
  worldRotation(node, delta.multiply(node.getWorldQuaternion(new THREE.Quaternion())));
}

/** Two-bone IK rotates joints without stretching or translating skin pivots. */
export function solveLimb(
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  target: THREE.Vector3,
  pole: THREE.Vector3,
) {
  const start = world(upper);
  const a = start.distanceTo(world(lower));
  const b = world(lower).distanceTo(world(end));
  const direction = target.clone().sub(start);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    Math.abs(a - b) + 0.0001,
    a + b - 0.0001,
  );
  direction.normalize();
  const bend = pole.clone().sub(start);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 0.00001) bend.crossVectors(direction, V(0, 0, 1));
  if (bend.lengthSq() < 0.00001) bend.crossVectors(direction, V(0, 1, 0));
  bend.normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const elbow = start
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  aim(upper, lower, elbow);
  aim(lower, end, start.addScaledVector(direction, distance));
}

/** A rotation whose hand axes point the fingers along `finger` and the thumb side along `thumbSide`. */
export function handBasis(finger: THREE.Vector3, thumbSide: THREE.Vector3) {
  const z = finger.clone().normalize();
  const y = thumbSide.clone().addScaledVector(z, -thumbSide.dot(z)).normalize();
  const x = y.clone().cross(z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
