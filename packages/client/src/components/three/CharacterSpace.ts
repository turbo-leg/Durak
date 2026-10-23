import * as THREE from 'three';
import { bindPosition, CARD_HEIGHT, SOCKETS } from '../../character/spec.ts';

/**
 * The room at real size. Characters are built in metres (character/spec.ts) and drawn at
 * CHARACTER_SCALE world units per metre; table, seating, cards and the carry distance are
 * all real measurements. Character forward is +Z; a Three camera looks along -Z.
 */
export const CHARACTER_SCALE = 3.3;
const m = (metres: number) => metres * CHARACTER_SCALE;
/** The felt surface, in world units. */
export const TABLE_TOP = 0.075;
/** An oval card table, 160 x 110 cm and 74 cm high. */
export const TABLE = { height: 0.74, radiusX: 0.8, radiusZ: 0.55 } as const;
export const TABLE_RADIUS_X = m(TABLE.radiusX);
export const TABLE_RADIUS_Z = m(TABLE.radiusZ);
/**
 * The table as built, outermost first: the wooden apron, the rail on it, the brass trim and
 * the felt. Each is an oval `grow` wider than the felt, with its top and depth.
 */
export const TABLE_LAYERS = [
  { grow: m(0.13), top: -0.08, depth: 0.44 },
  { grow: m(0.12), top: 0, depth: 0.12 },
  { grow: m(0.015), top: 0.035, depth: 0.06 },
  { grow: 0, top: TABLE_TOP, depth: 0.06 },
] as const;

/**
 * The shortest move, up onto the top or outward past the edge, that brings a ball of
 * `radius` at `point` clear of the table (world units); zero when it is already clear.
 * `upward` asks for the move straight up instead, however long.
 */
export function tableClearance(point: THREE.Vector3, radius = 0, upward = false) {
  const push = new THREE.Vector3();
  for (const layer of TABLE_LAYERS) {
    const across = Math.hypot(point.x, point.z);
    const reach = Math.hypot(
      point.x / (TABLE_RADIUS_X + layer.grow + radius),
      point.z / (TABLE_RADIUS_Z + layer.grow + radius),
    );
    if (reach >= 1 || point.y >= layer.top + radius || point.y <= layer.top - layer.depth - radius)
      continue;
    const up = layer.top + radius - point.y;
    const out = reach > 0 ? (1 / reach - 1) * across : Infinity;
    const move =
      upward || up <= out
        ? new THREE.Vector3(0, up, 0)
        : new THREE.Vector3(point.x, 0, point.z).setLength(out);
    if (move.lengthSq() > push.lengthSq()) push.copy(move);
  }
  return push;
}
export const CHARACTER_FLOOR = TABLE_TOP - m(TABLE.height);
/** Chairs stand 38 cm back from the table's edge. */
export const SEAT_RADIUS_X = m(TABLE.radiusX + 0.38);
export const SEAT_RADIUS_Z = m(TABLE.radiusZ + 0.38);
export const NEUTRAL_LOOK_DOWN = 0.22;
/** A hand of cards is held 40 cm in front of the eyes and 20 cm below them. */
export const CARRY_DEPTH = m(0.4);
export const CARRY_TILT = -0.1;
export const CARRY_Y = -m(0.2);
/** While the free hand reaches across in front, the held cards are drawn up this far. */
export const CARRY_RAISE = m(0.07);

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
/** Carry-frame units per world unit, so a held card is a real 88.9 mm tall. */
export const CARRY_SCALE = m(CARD_HEIGHT) / (HELD_CARD.height * HELD_CARD_SCALE);
/** Table cards share the 1.2-tall card geometry, scaled to the same real card. */
export const TABLE_CARD_SCALE = m(CARD_HEIGHT) / HELD_CARD.height;
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
