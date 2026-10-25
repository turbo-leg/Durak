import * as THREE from 'three';
import {
  CHARACTER_FLOOR,
  CHARACTER_SCALE,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  TABLE_TOP,
} from './CharacterSpace';

const cm = (value: number) => (value * CHARACTER_SCALE) / 100;
const FELT_Y = TABLE_TOP + cm(0.6);
const GRAVITY = cm(260);

export interface LooseCard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  bounces: number;
  grounded: boolean;
  settled: boolean;
}

const insideFelt = (x: number, z: number) =>
  (x / (TABLE_RADIUS_X - cm(5))) ** 2 + (z / (TABLE_RADIUS_Z - cm(5))) ** 2 < 1;

/** Aim the release at a loose spread on the felt from any chair around the table. */
export function looseCardLaunch(origin: THREE.Vector3, index: number, frustrated: boolean) {
  const up = cm((frustrated ? 44 : 35) + index * 5);
  const height = Math.max(0, origin.y - FELT_Y);
  const flight = (up + Math.sqrt(up * up + 2 * GRAVITY * height)) / GRAVITY;
  const radial = new THREE.Vector3(origin.x, 0, origin.z);
  if (radial.lengthSq() < 0.001) radial.set(0, 0, 1);
  radial.normalize();
  const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
  const target = radial
    .multiplyScalar(cm(frustrated ? 28 : 38))
    .addScaledVector(tangent, (index - 1.5) * cm(13));
  // Air drag costs a little horizontal travel during the arc.
  return new THREE.Vector3(
    ((target.x - origin.x) / Math.max(0.25, flight)) * 1.12,
    up,
    ((target.z - origin.z) / Math.max(0.25, flight)) * 1.12,
  );
}

/** Advance a released card. Missed cards fall away instead of hovering beyond the rail. */
export function stepLooseCard(card: LooseCard, seconds: number): 'moving' | 'settled' | 'gone' {
  if (card.settled) return 'settled';
  const dt = THREE.MathUtils.clamp(seconds, 0, 0.05);
  if (!dt) return 'moving';

  if (card.grounded) {
    const drag = Math.exp(-4.5 * dt);
    card.velocity.x *= drag;
    card.velocity.z *= drag;
    card.angularVelocity.multiplyScalar(Math.exp(-8 * dt));
    card.mesh.rotation.x *= Math.exp(-10 * dt);
    card.mesh.rotation.z *= Math.exp(-10 * dt);
  } else {
    const drag = Math.exp(-0.5 * dt);
    card.velocity.x *= drag;
    card.velocity.z *= drag;
    card.velocity.y -= GRAVITY * dt;
    card.angularVelocity.multiplyScalar(Math.exp(-0.8 * dt));
  }

  card.mesh.position.addScaledVector(card.velocity, dt);
  card.mesh.rotation.x += card.angularVelocity.x * dt;
  card.mesh.rotation.y += card.angularVelocity.y * dt;
  card.mesh.rotation.z += card.angularVelocity.z * dt;

  if (card.grounded && !insideFelt(card.mesh.position.x, card.mesh.position.z)) {
    card.grounded = false;
    card.velocity.y = -cm(5);
  }
  if (insideFelt(card.mesh.position.x, card.mesh.position.z)) {
    // A tilted card touches on a corner, then lowers as its last wobble dies away.
    const lift =
      cm(4) *
      Math.min(
        1,
        Math.abs(Math.sin(card.mesh.rotation.x)) + Math.abs(Math.sin(card.mesh.rotation.z)),
      );
    const contactY = FELT_Y + lift;
    if (card.grounded) card.mesh.position.y = contactY;
    if (card.mesh.position.y <= contactY && card.velocity.y <= 0) {
      card.mesh.position.y = contactY;
      if (!card.grounded && card.bounces < 2 && -card.velocity.y > cm(14)) {
        card.velocity.y *= -0.18;
        card.velocity.x *= 0.78;
        card.velocity.z *= 0.78;
        card.angularVelocity.multiplyScalar(0.6);
        card.bounces++;
      } else {
        card.grounded = true;
        card.velocity.y = 0;
      }
    }
  }

  if (card.mesh.position.y < CHARACTER_FLOOR - cm(12)) return 'gone';
  if (
    card.grounded &&
    Math.hypot(card.velocity.x, card.velocity.z) < cm(1.5) &&
    card.angularVelocity.length() < 0.05 &&
    Math.abs(card.mesh.rotation.x) + Math.abs(card.mesh.rotation.z) < 0.025
  ) {
    card.velocity.set(0, 0, 0);
    card.angularVelocity.set(0, 0, 0);
    card.mesh.rotation.x = 0;
    card.mesh.rotation.z = 0;
    card.mesh.position.y = FELT_Y;
    card.settled = true;
    return 'settled';
  }
  return 'moving';
}
