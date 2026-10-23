import * as THREE from 'three';
import { gestureWeight, type PublicGesture } from '@durak/shared';
import { CASUAL_FACE, carryMatrix, gripPoint, headLook } from './CharacterSpace';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const world = (node: THREE.Object3D) => node.getWorldPosition(V());

function worldRotation(node: THREE.Object3D, rotation: THREE.Quaternion) {
  const parent = node.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  node.quaternion.copy(parent.invert().multiply(rotation));
  node.updateWorldMatrix(false, true);
}

function aim(node: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
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

/** Authored Quaternius bones. All targets below are in normalized character space. */
export class CasualPose {
  readonly bones = new Map<string, THREE.Bone>();
  private rest = new Map<string, { position: THREE.Vector3; rotation: THREE.Quaternion }>();
  private frames = new Map<string, THREE.Quaternion>();
  private curlAxes = new Map<string, THREE.Vector3>();

  constructor(
    readonly root: THREE.Object3D,
    readonly firstPerson = false,
  ) {
    root.updateWorldMatrix(true, true);
    root.traverse((node) => {
      if (!(node instanceof THREE.Bone)) return;
      this.bones.set(node.name, node);
      this.rest.set(node.name, {
        position: node.position.clone(),
        rotation: node.quaternion.clone(),
      });
    });
    for (const side of ['L', 'R']) {
      const hand = this.bone(`Hand${side}`);
      const inverse = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
      const finger = world(this.bone(`Middle2${side}`))
        .sub(world(hand))
        .normalize();
      const spread = world(this.bone(`Index2${side}`))
        .sub(world(this.bone(`Pinky2${side}`)))
        .normalize();
      const palm = finger
        .clone()
        .cross(spread)
        .multiplyScalar(side === 'R' ? -1 : 1)
        .normalize();
      finger.applyQuaternion(inverse);
      palm.applyQuaternion(inverse);
      this.frames.set(side, this.frame(finger, palm).invert());
      this.curlAxes.set(side, finger.clone().cross(palm).normalize());
    }
  }

  private bone(name: string) {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Casual rig is missing ${name}`);
    return bone;
  }

  private point(x: number, y: number, z: number) {
    return this.root.localToWorld(V(x, y, z));
  }

  private frame(finger: THREE.Vector3, palm: THREE.Vector3) {
    const y = finger.clone().normalize();
    const x = y.clone().cross(palm).normalize();
    const z = x.clone().cross(y).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  private arm(side: string, wrist: THREE.Vector3, finger: THREE.Vector3, palm: THREE.Vector3) {
    const sign = side === 'R' ? -1 : 1;
    solveLimb(
      this.bone(`UpperArm${side}`),
      this.bone(`LowerArm${side}`),
      this.bone(`Hand${side}`),
      this.root.localToWorld(wrist.clone()),
      this.point(sign * 1.15, 1.2, 0.25),
    );
    const rootRotation = this.root.getWorldQuaternion(new THREE.Quaternion());
    const orientation = this.frame(finger, palm).multiply(this.frames.get(side)!);
    worldRotation(this.bone(`Hand${side}`), rootRotation.multiply(orientation));
  }

  private fingers(side: string, extended: number, grip: boolean) {
    const handRotation = this.bone(`Hand${side}`).getWorldQuaternion(new THREE.Quaternion());
    const axis = this.curlAxes.get(side)!.clone().applyQuaternion(handRotation);
    ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'].forEach((finger, i) => {
      const open = i < extended;
      for (const [j, segment] of (finger === 'Thumb' ? [2, 3] : [2, 3, 4]).entries()) {
        const bone = this.bone(`${finger}${segment}${side}`);
        // Bend around the palm's transverse axis, expressed in each joint's coordinates.
        const localAxis = axis
          .clone()
          .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
        const amount =
          finger === 'Thumb'
            ? grip
              ? 0.25
              : 0.65
            : open
              ? 0.035
              : grip
                ? [0.8, 1.1, 0.7][j]!
                : [1.25, 1.1, 0.7][j]!;
        bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(localAxis, amount));
        bone.updateWorldMatrix(false, true);
      }
    });
    if (!grip) {
      // Counts use four long fingers; keep the thumb folded across the palm.
      const thumb = this.bone(`Thumb2${side}`);
      aim(thumb, this.bone(`Thumb3${side}`), world(this.bone(`Ring2${side}`)));
    } else {
      aim(
        this.bone(`Thumb2${side}`),
        this.bone(`Thumb3${side}`),
        world(this.bone(`Index2${side}`)),
      );
    }
  }

  prepareHead(yaw: number, pitch: number) {
    for (const [name, rest] of this.rest) {
      const bone = this.bone(name);
      bone.position.copy(rest.position);
      bone.quaternion.copy(rest.rotation);
    }
    this.root.updateWorldMatrix(true, true);
    {
      const hips = this.bone('Hips');
      const p = this.root.worldToLocal(world(hips));
      p.y -= 0.68;
      hips.position.copy(hips.parent!.worldToLocal(this.root.localToWorld(p)));
      this.root.updateWorldMatrix(true, true);
      for (const side of this.firstPerson ? [] : ['L', 'R']) {
        const x = side === 'R' ? -0.2 : 0.2;
        solveLimb(
          this.bone(`UpperLeg${side}`),
          this.bone(`LowerLeg${side}`),
          this.bone(`Foot${side}`),
          this.point(x, -0.35, 0.75),
          this.point(x, 1, 1.7),
        );
      }
    }
    // The seated torso follows most of a wide look; the neck supplies the rest.
    // Both views use this pose, so the arms keep a reachable shoulder position.
    for (const [name, share] of [
      ['Abdomen', 0.3],
      ['Torso', 0.3],
      ['Chest', 0.2],
    ] as const) {
      const bone = this.bone(name);
      worldRotation(
        bone,
        new THREE.Quaternion()
          .setFromAxisAngle(V(0, 1, 0), yaw * share)
          .multiply(bone.getWorldQuaternion(new THREE.Quaternion())),
      );
    }
    const head = this.bone('Head');
    head.quaternion.multiply(headLook(yaw * 0.2, pitch));
    this.root.updateWorldMatrix(true, true);
  }

  view() {
    const head = this.bone('Head');
    const quaternion = head.getWorldQuaternion(new THREE.Quaternion());
    const position = CASUAL_FACE.eyes
      .clone()
      .multiplyScalar(this.root.getWorldScale(V()).x)
      .applyQuaternion(quaternion)
      .add(world(head));
    return {
      position,
      quaternion: quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI)),
    };
  }

  pose(
    yaw: number,
    pitch: number,
    gesture: PublicGesture,
    now: number,
    reduced: boolean,
    count = 5,
    gripFrame?: THREE.Matrix4,
  ) {
    this.prepareHead(yaw, pitch);
    const head = this.bone('Head');
    const view = this.view();
    const frame = gripFrame ?? carryMatrix(view, undefined, this.root.getWorldScale(V()).x);
    const cameraToRoot = this.root
      .getWorldQuaternion(new THREE.Quaternion())
      .invert()
      .multiply(view.quaternion);
    const palmDirection = V(0, -0.2, -1).applyQuaternion(cameraToRoot);
    for (const side of ['L', 'R']) {
      const fingerDirection = V(side === 'L' ? 0.25 : -0.25, 0.86, -0.5)
        .normalize()
        .applyQuaternion(cameraToRoot);
      const sign = side === 'R' ? -1 : 1;
      const resting = count === 0 && !this.firstPerson;
      this.arm(
        side,
        resting
          ? V(sign * 0.35, 1.4, 0.45)
          : this.root.worldToLocal(gripPoint(side as 'L' | 'R', count).applyMatrix4(frame)),
        resting ? V(0, 0, 1) : fingerDirection,
        resting ? V(0, -1, 0) : palmDirection,
      );
      this.fingers(side, 0, true);
    }
    const weight = gestureWeight(gesture, now, reduced);
    if (!weight) return false;
    const left = gesture.gestureId === 'ear-left';
    const side = left ? 'L' : 'R';
    const affected = [...this.bones].filter(
      ([name]) =>
        /^(UpperArm|LowerArm|Hand|Index|Middle|Ring|Pinky|Thumb)/.test(name) && name.endsWith(side),
    );
    const base = new Map(affected.map(([name, bone]) => [name, bone.quaternion.clone()]));
    // Reset this arm before authoring its target; blend back into the unmodified grip.
    affected.forEach(([name, bone]) => bone.quaternion.copy(this.rest.get(name)!.rotation));
    this.root.updateWorldMatrix(true, true);
    const countGesture = ['one', 'two', 'three', 'four'].indexOf(gesture.gestureId || '') + 1;
    if (countGesture) {
      this.arm(side, V(-0.65, 2.1, 0.48), V(0, 1, 0), V(0, 0, 1));
      this.fingers(side, countGesture, false);
    } else {
      // Contact anchors follow the head, including when the player looks around.
      const ear = gesture.gestureId !== 'nose';
      // Derive anchors using world head orientation
      // and the normalized root scale instead of assuming a particular export unit.
      const headPosition = world(head);
      const headOrientation = head.getWorldQuaternion(new THREE.Quaternion());
      const scale = this.root.getWorldScale(V()).x;
      const landmark = CASUAL_FACE[ear ? (left ? 'ear-left' : 'ear-right') : 'nose'];
      const anchor = landmark
        .clone()
        .multiplyScalar(scale)
        .applyQuaternion(headOrientation)
        .add(headPosition);
      const headToRoot = this.root
        .getWorldQuaternion(new THREE.Quaternion())
        .invert()
        .multiply(headOrientation);
      const direction = V(ear ? (left ? -0.7 : 0.7) : 0, 0.75, -0.4)
        .normalize()
        .applyQuaternion(headToRoot);
      const palm = V(0, 0.4, 0.8).applyQuaternion(headToRoot);
      const wristWorld = anchor
        .clone()
        .addScaledVector(
          direction.clone().applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion())),
          -0.4 * scale,
        );
      const wrist = this.root.worldToLocal(wristWorld);
      this.arm(side, wrist, direction, palm);
      this.fingers(side, 1, false);
      const tip = this.bone(`Index4${side}`).children[0] ?? this.bone(`Index4${side}`);
      for (let i = 0; i < 2; i++) {
        const correction = anchor.clone().sub(world(tip));
        const adjusted = this.root.worldToLocal(world(this.bone(`Hand${side}`)).add(correction));
        this.arm(side, adjusted, direction, palm);
      }
    }
    affected.forEach(([name, bone]) => {
      const target = bone.quaternion.clone();
      bone.quaternion.copy(base.get(name)!).slerp(target, weight);
    });
    this.root.updateWorldMatrix(true, true);
    return !reduced;
  }
}
