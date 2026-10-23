import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { PublicGesture } from '@durak/shared';
import { CasualPose } from './CasualPose';
import { AvatarRig } from './AvatarRig';
import { carryMatrix, CHARACTER_SCALE, CHARACTER_FLOOR, SEAT_RADIUS_Z } from './CharacterSpace';

/** Each load owns its geometry, skeleton and materials, including a late result after disposal. */
export function disposeCharacter(root: THREE.Object3D) {
  const resources = new Set<{ dispose(): void }>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    resources.add(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => resources.add(material));
    if (node instanceof THREE.SkinnedMesh) resources.add(node.skeleton);
  });
  resources.forEach((resource) => resource.dispose());
  root.removeFromParent();
}

export class CasualAvatar {
  readonly root = new THREE.Group();
  readonly presetId = 'casual';
  readonly fan = new THREE.Group();
  private pose?: CasualPose;
  private model?: THREE.Group;
  private fallback?: AvatarRig;
  private disposed = false;
  private yaw = 0;
  private pitch = 0;
  private shownYaw = 0;
  private shownPitch = 0;
  private lastFrame = 0;
  private gesture: PublicGesture = {};
  private offset = 0;
  private count = 5;

  constructor(changed: () => void) {
    this.root.name = 'casual-seated-avatar';
    this.root.add(this.fan);
    this.fallback = new AvatarRig('copper');
    this.root.add(this.fallback.root);
    new GLTFLoader().load(
      '/models/casual/casual.glb',
      ({ scene }) => {
        if (this.disposed) {
          disposeCharacter(scene);
          return;
        }
        try {
          this.model = scene;
          this.root.add(scene);
          this.pose = new CasualPose(scene);
          this.pose.pose(
            this.yaw,
            this.pitch,
            this.gesture,
            Date.now() + this.offset,
            true,
            this.count,
          );
          this.fallback?.dispose();
          this.fallback = undefined;
        } catch {
          disposeCharacter(scene);
          this.pose = undefined;
          this.model = undefined;
        }
        changed();
      },
      undefined,
      () => {
        if (!this.disposed) changed();
      },
    );
  }

  update(yaw: number, pitch: number, played: number, now: number) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.fallback?.update(yaw, pitch, played, now);
  }
  setGesture(gesture: PublicGesture, offset = 0, count = 5) {
    this.gesture = gesture;
    this.offset = offset;
    this.count = count;
  }
  animate(now: number, reduced: boolean) {
    if (this.fallback) return this.fallback.animate(now, reduced);
    const blend = reduced ? 1 : 1 - Math.exp(-12 * Math.min(0.2, now - this.lastFrame));
    this.lastFrame = now;
    this.shownYaw = THREE.MathUtils.lerp(this.shownYaw, this.yaw, blend);
    this.shownPitch = THREE.MathUtils.lerp(this.shownPitch, this.pitch, blend);
    const moving =
      this.pose?.pose(
        this.shownYaw,
        this.shownPitch,
        this.gesture,
        Date.now() + this.offset,
        reduced,
        Math.min(7, this.count),
      ) ?? false;
    if (this.pose) {
      this.root.updateWorldMatrix(true, false);
      const local = this.root.matrixWorld
        .clone()
        .invert()
        .multiply(
          carryMatrix(this.pose.view(), undefined, this.root.getWorldScale(new THREE.Vector3()).x),
        );
      local.decompose(this.fan.position, this.fan.quaternion, this.fan.scale);
    }
    return (
      moving ||
      (!reduced &&
        (Math.abs(this.shownYaw - this.yaw) > 0.002 ||
          Math.abs(this.shownPitch - this.pitch) > 0.002))
    );
  }
  dispose() {
    this.disposed = true;
    this.fallback?.dispose();
    if (this.model) disposeCharacter(this.model);
    this.root.removeFromParent();
  }
}

/** Matching forearms, wrists and fingers; independent joints preserve skin continuity. */
export function makeCasualHands(
  changed: () => void,
  options?: {
    camera: THREE.PerspectiveCamera;
    cards: THREE.Group;
    look: () => { yaw: number; pitch: number };
  },
) {
  const root = new THREE.Group();
  root.name = 'casual-first-person-hands';
  root.position.set(0, CHARACTER_FLOOR, SEAT_RADIUS_Z);
  root.rotation.y = Math.PI;
  root.scale.setScalar(CHARACTER_SCALE);
  let disposed = false;
  let model: THREE.Group | undefined;
  let pose: CasualPose | undefined;
  let gesture: PublicGesture = {};
  let offset = 0;
  let count = 5;
  new GLTFLoader().load(
    '/models/casual/arms.glb',
    ({ scene }) => {
      if (disposed) {
        disposeCharacter(scene);
        return;
      }
      try {
        model = scene;
        root.add(scene);
        pose = new CasualPose(scene, true);
        scene.traverse((node) => {
          if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false;
        });
        pose.pose(0, 0, gesture, Date.now() + offset, true, count);
      } catch {
        disposeCharacter(scene);
        pose = undefined;
        model = undefined;
      }
      changed();
    },
    undefined,
    () => {
      if (!disposed) changed();
    },
  );
  return {
    root,
    setCardCount(value: number, _size = 1) {
      count = value;
    },
    setGesture(value: PublicGesture, clockOffset = 0) {
      gesture = value;
      offset = clockOffset;
    },
    animate(_now: number, reduced: boolean) {
      if (!pose) return false;
      const { yaw, pitch } = options?.look() ?? { yaw: 0, pitch: 0 };
      pose.prepareHead(yaw, pitch);
      if (options) {
        const view = pose.view();
        options.camera.position.copy(view.position);
        options.camera.quaternion.copy(view.quaternion);
        options.camera.updateWorldMatrix(true, true);
        options.cards.updateWorldMatrix(true, false);
      }
      return pose.pose(
        yaw,
        pitch,
        gesture,
        Date.now() + offset,
        reduced,
        count,
        options?.cards.matrixWorld,
      );
    },
    view(yaw: number, pitch: number) {
      if (!pose) return undefined;
      pose.prepareHead(yaw, pitch);
      return pose.view();
    },
    dispose() {
      disposed = true;
      if (model) disposeCharacter(model);
      root.removeFromParent();
    },
  };
}
