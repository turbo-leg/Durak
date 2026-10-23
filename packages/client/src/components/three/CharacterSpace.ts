import * as THREE from 'three';

/** Shared seated proportions and measured landmarks from the shipped Casual mesh.
 * Landmark offsets are in normalized character coordinates, relative to Head.
 * Character forward is +Z; a Three camera looks along -Z.
 */
export const CHARACTER_SCALE = 1.6;
export const CARD_HOLD_HEIGHT = 0.4;
export const CHARACTER_FLOOR = CARD_HOLD_HEIGHT - 1.6 * CHARACTER_SCALE;
export const SEAT_RADIUS_Z = 4.65;
export const NEUTRAL_LOOK_DOWN = 0.22;
export const CARRY_DEPTH = 0.85;
export const CARRY_SCALE = 0.3;
export const CARRY_TILT = -0.1;
export const CARRY_Y = -0.55;
export const CASUAL_HEAD = new THREE.Vector3(-0.000661685, 3.063135909 - 0.68, 0.082925814);
export const CASUAL_FACE = {
  eyes: new THREE.Vector3(0.000661685, 0.210608815, 0.194660098),
  nose: new THREE.Vector3(0.000661685, 0.11090426, 0.254004177),
  'ear-left': new THREE.Vector3(0.204, 0.205, 0.058),
  'ear-right': new THREE.Vector3(-0.203, 0.205, 0.058),
} as const;

export function headLook(yaw: number, pitch: number) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(NEUTRAL_LOOK_DOWN - pitch, yaw, 0, 'YXZ'),
  );
}

/** Same physical carry frame for peer cards, local cards and the gesture mirror. */
export function carryMatrix(
  eyes: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  y = CARRY_Y,
  anatomicalScale = CHARACTER_SCALE,
) {
  const factor = anatomicalScale / CHARACTER_SCALE;
  return new THREE.Matrix4()
    .compose(eyes.position, eyes.quaternion, new THREE.Vector3(1, 1, 1))
    .multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(0, y * factor, -CARRY_DEPTH * factor),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CARRY_TILT),
        new THREE.Vector3(CARRY_SCALE * factor, CARRY_SCALE * factor, CARRY_SCALE * factor),
      ),
    );
}

export function gripPoint(side: 'L' | 'R', count: number) {
  const spread = 0.85 + Math.sin(Math.min(0.75, Math.max(0, count - 1) * 0.125)) * 0.35;
  return new THREE.Vector3(side === 'L' ? -spread : spread, -1.7, 0);
}

/** Eye position for the local chair, matching the same head pose peers render. */
export function seatedEyes(yaw: number, pitch: number, preset = 'casual') {
  const head = preset === 'casual' ? CASUAL_HEAD : new THREE.Vector3(0, 2.25, 0);
  const eyes = preset === 'casual' ? CASUAL_FACE.eyes : new THREE.Vector3(0, 0.43, 0.4);
  return eyes
    .clone()
    .applyQuaternion(headLook(yaw, pitch))
    .add(head)
    .multiplyScalar(CHARACTER_SCALE)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    .add(new THREE.Vector3(0, CHARACTER_FLOOR, SEAT_RADIUS_Z));
}
