import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { looseCardLaunch, stepLooseCard, type LooseCard } from '../components/three/cardPhysics';
import {
  SEAT_RADIUS_X,
  SEAT_RADIUS_Z,
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  TABLE_TOP,
} from '../components/three/CharacterSpace';

const looseCard = (x = 0): LooseCard => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.55));
  mesh.position.set(x, TABLE_TOP + 1, 0);
  mesh.rotation.x = 0.55;
  return {
    mesh,
    velocity: new THREE.Vector3(0.25, 0, 0),
    angularVelocity: new THREE.Vector3(2, 0.6, -1),
    bounces: 0,
    grounded: false,
    settled: false,
  };
};

describe('loose card physics', () => {
  it('bounces, skids and settles flat on the felt', () => {
    const card = looseCard();
    const frames: string[] = [];
    for (let i = 0; i < 360; i++) {
      frames.push(stepLooseCard(card, 1 / 60));
      if (card.settled) break;
    }
    expect(card.bounces).toBeGreaterThan(0);
    expect(frames).toContain('moving');
    expect(frames.at(-1)).toBe('settled');
    expect(card.mesh.position.x).toBeGreaterThan(0.1);
    expect(card.mesh.position.y).toBeCloseTo(TABLE_TOP + 0.0198, 3);
    expect(card.mesh.rotation.x).toBe(0);
    expect(card.mesh.rotation.z).toBe(0);
  });

  it('lets a card that misses the felt fall away', () => {
    const card = looseCard(TABLE_RADIUS_X + 0.2);
    let outcome = 'moving';
    for (let i = 0; i < 240 && outcome === 'moving'; i++) outcome = stepLooseCard(card, 1 / 60);
    expect(outcome).toBe('gone');
    expect(card.grounded).toBe(false);
  });

  it('aims cards from every side of the table onto the felt', () => {
    for (const origin of [
      new THREE.Vector3(SEAT_RADIUS_X, TABLE_TOP + 0.8, 0),
      new THREE.Vector3(-SEAT_RADIUS_X, TABLE_TOP + 0.8, 0),
      new THREE.Vector3(0, TABLE_TOP + 0.8, SEAT_RADIUS_Z),
      new THREE.Vector3(0, TABLE_TOP + 0.8, -SEAT_RADIUS_Z),
    ]) {
      const card = looseCard();
      card.mesh.position.copy(origin);
      card.velocity.copy(looseCardLaunch(origin, 2, false));
      for (let i = 0; i < 240 && !card.grounded; i++) stepLooseCard(card, 1 / 60);
      expect(card.grounded).toBe(true);
      expect(
        (card.mesh.position.x / TABLE_RADIUS_X) ** 2 + (card.mesh.position.z / TABLE_RADIUS_Z) ** 2,
      ).toBeLessThan(1);
    }
  });
});
