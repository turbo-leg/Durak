import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { avatarPreset } from '@durak/shared';

/** The generic-hand assets used by XRHandMeshModel, posed without an XR session.
 * Their joints are siblings in model space, so a bend must move every downstream
 * joint as well as its rotation. Changing only a bone's Euler angle tears the skin.
 */
function poseGrip(model: THREE.Object3D, side: number) {
  const wrist = model.getObjectByName('wrist')!;
  const wristRotation = wrist.quaternion.clone();
  const bend = (names: string[], angle: number, localAxis = new THREE.Vector3(1, 0, 0)) => {
    const pivot = model.getObjectByName(names[0]!)!.position.clone();
    const axis = localAxis.clone().applyQuaternion(wristRotation);
    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    for (const name of names) {
      const joint = model.getObjectByName(name)!;
      joint.position.sub(pivot).applyQuaternion(rotation).add(pivot);
      joint.quaternion.premultiply(rotation);
    }
  };
  for (const finger of ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) {
    const names = [
      'metacarpal',
      'phalanx-proximal',
      'phalanx-intermediate',
      'phalanx-distal',
      'tip',
    ].map((joint) => `${finger}-${joint}`);
    bend(names, -0.28);
    bend(names.slice(1), -0.65);
    bend(names.slice(2), -0.9);
    bend(names.slice(3), -0.3);
  }
  // Oppose the thumb at its base while preserving every segment's length.
  // Translating individual joints stretches the thumb web and breaks the grip.
  bend(
    ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
    -side * 0.6,
    new THREE.Vector3(0, 0, 1),
  );
  bend(['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'], 0.2);
  return wrist;
}

export function makeFirstPersonHands(presetId: string, changed: () => void) {
  const root = new THREE.Group();
  root.name = 'first-person-hands';
  let cardCount = 5;
  let cardScale = 1;
  const positionGrip = (hand: THREE.Group, side: number) => {
    const spread =
      (0.56 + Math.sin(Math.min(0.75, Math.max(0, cardCount - 1) * 0.125)) * 0.92) * cardScale;
    hand.position.set(
      side * (spread + 0.35),
      (side === -1 ? -0.92 : -0.95) + 0.6 * (1 - cardScale),
      side === -1 ? THREE.MathUtils.lerp(0.03, -0.08, Math.min(1, (cardCount - 1) / 3)) : 0.04,
    );
  };
  const resources = new Set<{ dispose(): void }>();
  let disposed = false;
  const preset = avatarPreset(presetId);
  const skin = new THREE.MeshStandardMaterial({ color: preset.skin, roughness: 0.86 });
  const shirt = new THREE.MeshStandardMaterial({ color: preset.shirt, roughness: 0.95 });
  const cuff = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.shirt).multiplyScalar(0.75),
    roughness: 0.95,
  });
  resources.add(skin);
  resources.add(shirt);
  resources.add(cuff);
  const loader = new GLTFLoader();
  for (const [handedness, side] of [
    ['left', -1],
    ['right', 1],
  ] as const) {
    loader.load(
      `${import.meta.env.BASE_URL}models/hands/${handedness}.glb`,
      (gltf) => {
        const owned = new Set<{ dispose(): void }>();
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            owned.add(object.geometry);
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              owned.add(material);
          }
          if (object instanceof THREE.SkinnedMesh) owned.add(object.skeleton);
        });
        if (disposed) {
          owned.forEach((resource) => resource.dispose());
          return;
        }
        owned.forEach((resource) => resources.add(resource));
        const wrist = poseGrip(gltf.scene, side);
        // Normalize the exported wrist frame: fingers rise along +Y, thumb inward.
        const inverse = wrist.quaternion.clone().invert();
        gltf.scene.quaternion.copy(inverse);
        gltf.scene.position.copy(wrist.position).negate().applyQuaternion(inverse);
        const frame = new THREE.Group();
        frame.rotation.x = Math.PI / 2;
        frame.scale.setScalar(3.9);
        frame.add(gltf.scene);
        const hand = new THREE.Group();
        hand.name = `${handedness}-card-grip`;
        hand.scale.setScalar(2);
        // Palms cradle the outer corners; wrists and thumbs angle into the fan.
        positionGrip(hand, side);
        hand.rotation.z = side === -1 ? -0.28 : -0.08;
        hand.rotation.y = side === -1 ? -0.25 : 0.35;
        hand.add(frame);
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.SkinnedMesh) {
            object.material = skin;
            // The small posed mesh stays attached to the camera, not its bind bounds.
            object.frustumCulled = false;
          }
        });
        const sleeveGeometry = new THREE.CylinderGeometry(0.14, 0.18, 0.65, 12);
        const cuffGeometry = new THREE.CylinderGeometry(0.145, 0.15, 0.09, 12);
        resources.add(sleeveGeometry);
        resources.add(cuffGeometry);
        const sleeve = new THREE.Mesh(sleeveGeometry, shirt);
        sleeve.position.set(side * 0.04, -0.37, 0);
        sleeve.rotation.z = side * 0.1;
        const sleeveEnd = new THREE.Mesh(cuffGeometry, cuff);
        sleeveEnd.position.y = -0.055;
        hand.add(sleeve, sleeveEnd);
        root.add(hand);
        changed();
      },
      undefined,
      () => {
        // A failed cosmetic asset must leave the cards playable; no XR permission prompt.
        if (!disposed) changed();
      },
    );
  }
  return {
    root,
    setCardCount: (count: number, scale = 1) => {
      cardCount = count;
      cardScale = scale;
      for (const hand of root.children) {
        if (hand instanceof THREE.Group) positionGrip(hand, hand.name.startsWith('left') ? -1 : 1);
      }
    },
    dispose: () => {
      disposed = true;
      resources.forEach((resource) => resource.dispose());
      root.removeFromParent();
    },
  };
}
