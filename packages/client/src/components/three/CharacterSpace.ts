import * as THREE from 'three';
import { bindPosition, SOCKETS } from '../../character/spec.ts';

/** Shared seated proportions. Character landmarks come from the character contract
 * (character/spec.ts), in normalized character coordinates. Character forward is +Z;
 * a Three camera looks along -Z.
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

/** Held cards in the carry frame: upright, fanned about a pivot below the hand. */
export const HELD_CARD_SCALE = 0.8;
/** Held card geometry before its scale: a flattened card bowed toward its face at both ends. */
export const HELD_CARD = { width: 0.82, height: 1.2, thickness: 0.035 * 0.35, bow: 0.025 };
export const heldCardBow = (z: number) => HELD_CARD.bow * (z / (HELD_CARD.height / 2)) ** 2;
export const HELD_FAN_RADIUS = 1.35;

/** Angle between neighbouring held cards; narrow local viewports compress large hands. */
export function fanStep(count: number, aspect = Infinity) {
  const spread = Math.min(0.75, 1.5 * aspect);
  return Math.min(0.25, (2 * spread) / Math.max(1, count - 1));
}

/** Half-angle of the whole fan, from its centre to the outermost card. */
export function fanHalfAngle(count: number, aspect = Infinity) {
  return (fanStep(count, aspect) * Math.max(0, count - 1)) / 2;
}

export function heldCard(index: number, count: number, step: number, raised = false) {
  const offset = index - (count - 1) / 2;
  const angle = offset * step;
  const radius = HELD_FAN_RADIUS + (raised ? 0.23 : 0);
  return {
    angle,
    position: new THREE.Vector3(
      Math.sin(angle) * radius * HELD_CARD_SCALE,
      (Math.cos(angle) * radius - HELD_FAN_RADIUS) * HELD_CARD_SCALE,
      offset * 0.018 + (raised ? 0.12 : 0),
    ),
  };
}

/** Eye position for the local chair before the character loads, from its bind pose. */
export function seatedEyes(yaw: number, pitch: number) {
  return new THREE.Vector3(...SOCKETS.Eyes!.at)
    .applyQuaternion(headLook(yaw, pitch))
    .add(bindPosition('Head'))
    .multiplyScalar(CHARACTER_SCALE)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    .add(new THREE.Vector3(0, CHARACTER_FLOOR, SEAT_RADIUS_Z));
}
