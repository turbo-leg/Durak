import * as THREE from 'three';
import { avatarPreset } from '@durak/shared';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NEUTRAL_LOOK_DOWN } from './CharacterSpace';

function mergeStaticParts(parent: THREE.Group, resources: { dispose(): void }[]) {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of parent.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const meshes = groups.get(child.material) || [];
    meshes.push(child);
    groups.set(child.material, meshes);
  }
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (!geometry) continue;
    resources.push(geometry);
    meshes.forEach((mesh) => mesh.removeFromParent());
    parent.add(new THREE.Mesh(geometry, material));
  }
}

/** Shared modular proportions; appearance parts can later be replaced by authored assets. */
export class AvatarRig {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private torso = new THREE.Group();
  private eyes = new THREE.Group();
  private arms = new THREE.Group();
  private resources: { dispose(): void }[] = [];
  private gesture = -Infinity;
  private lastPlayed: number | undefined;
  private yaw = 0;
  private pitch = 0;
  private phase: number;

  constructor(
    readonly presetId: string,
    phase = 0,
  ) {
    this.phase = phase;
    const preset = avatarPreset(presetId);
    const skin = this.material(preset.skin);
    const shirt = this.material(preset.shirt);
    const hair = this.material(preset.hair);
    const ink = this.material('#25303a');
    const white = this.material('#f0e9db');
    const wood = this.material('#49382e');
    const iris = this.material('#64513e');
    const lip = this.material(new THREE.Color(preset.skin).multiplyScalar(0.62).getStyle());
    const seam = this.material(new THREE.Color(preset.shirt).multiplyScalar(0.72).getStyle());
    this.root.add(this.torso, this.arms, this.head);
    this.head.position.y = 2.25;
    const face = new THREE.SphereGeometry(1, 24, 18);
    const vertices = face.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getY(i);
      const jaw = y < -0.15 ? THREE.MathUtils.lerp(0.72, 1, (y + 1) / 0.85) : 1;
      vertices.setXYZ(i, vertices.getX(i) * 0.43 * jaw, y * 0.53 + 0.35, vertices.getZ(i) * 0.38);
    }
    face.computeVertexNormals();
    this.mesh(this.head, skin, face);
    for (const side of [-1, 1]) {
      this.ball(this.head, skin, [side * 0.415, 0.34, 0], [0.065, 0.115, 0.075]);
      this.ball(this.head, lip, [side * 0.451, 0.34, 0.025], [0.017, 0.058, 0.038]);
    }
    this.ball(this.head, skin, [0, 0.36, 0.363], [0.044, 0.105, 0.053]);
    this.ball(this.head, skin, [0, 0.28, 0.41], [0.058, 0.055, 0.065]);
    this.head.add(this.eyes);
    this.eyes.position.y = 0.43;
    for (const side of [-1, 1]) {
      this.ball(this.eyes, white, [side * 0.16, 0, 0.355], [0.082, 0.044, 0.043]);
      this.ball(this.eyes, iris, [side * 0.16, 0, 0.393], [0.03, 0.035, 0.012]);
      this.ball(this.eyes, ink, [side * 0.16, 0, 0.402], [0.016, 0.025, 0.007]);
      this.ball(this.eyes, white, [side * 0.16 - 0.009, 0.012, 0.408], [0.006, 0.008, 0.003]);
      this.ball(this.head, skin, [side * 0.16, 0.478, 0.345], [0.091, 0.025, 0.039]);
      const brow = this.ball(this.head, hair, [side * 0.16, 0.53, 0.342], [0.09, 0.014, 0.022]);
      brow.rotation.z = side * 0.1;
    }
    this.curve(
      this.head,
      lip,
      [
        new THREE.Vector3(-0.075, 0.155, 0.35),
        new THREE.Vector3(0, 0.11, 0.374),
        new THREE.Vector3(0.075, 0.155, 0.35),
      ],
      0.011,
    );
    const cap = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairPoints = cap.attributes.position;
    for (let i = 0; i < hairPoints.count; i++) {
      const y = hairPoints.getY(i),
        z = hairPoints.getZ(i);
      hairPoints.setXYZ(
        i,
        hairPoints.getX(i) * 0.445,
        0.48 + (y + Math.max(0, z) * 0.3 * (1 - y)) * 0.43,
        z * 0.395 - 0.025,
      );
    }
    cap.computeVertexNormals();
    this.mesh(this.head, hair, cap);
    if (preset.hairStyle === 0) {
      const sweep = this.ball(this.head, hair, [-0.07, 0.83, 0.12], [0.33, 0.12, 0.26]);
      sweep.rotation.z = -0.14;
    }
    if (preset.hairStyle === 1) {
      this.ball(this.head, hair, [0, 0.35, -0.28], [0.435, 0.46, 0.17]);
      for (const side of [-1, 1])
        this.ball(this.head, hair, [side * 0.39, 0.34, -0.06], [0.095, 0.33, 0.2]);
    }
    if (preset.hairStyle === 2) {
      for (let i = 0; i < 10; i++)
        this.ball(
          this.head,
          hair,
          [Math.sin(i * 2.4) * 0.3, 0.77 + (i % 3) * 0.045, Math.cos(i * 2.4) * 0.24],
          [0.135, 0.14, 0.13],
        );
    }
    if (preset.hairStyle === 3) {
      const sweep = this.ball(this.head, hair, [0.13, 0.82, 0.1], [0.28, 0.13, 0.27]);
      sweep.rotation.z = 0.16;
    }
    const body = new THREE.LatheGeometry(
      [
        [0, 0.74],
        [0.42, 0.74],
        [0.48, 0.85],
        [0.5, 1.2],
        [0.54, 1.6],
        [0.65, 1.86],
        [0.61, 1.98],
        [0.4, 2.04],
        [0.2, 2.09],
        [0, 2.09],
      ].map(([x, y]) => new THREE.Vector2(x!, y!)),
      24,
    );
    body.scale(1, 1, 0.58);
    this.mesh(this.torso, shirt, body);
    const collar = this.mesh(this.torso, seam, new THREE.TorusGeometry(0.19, 0.035, 8, 24));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 2.075;
    this.ball(this.torso, skin, [0, 2.12, 0], [0.18, 0.23, 0.18]);
    for (const side of [-1, 1]) {
      this.segment(
        this.arms,
        shirt,
        new THREE.Vector3(side * 0.62, 1.93, 0),
        new THREE.Vector3(side * 0.87, 1.1, 0.28),
        0.17,
      );
      this.ball(this.arms, shirt, [side * 0.85, 1.12, 0.28], [0.17, 0.18, 0.17]);
      this.segment(
        this.arms,
        shirt,
        new THREE.Vector3(side * 0.87, 1.1, 0.28),
        new THREE.Vector3(side * 0.35, 1.18, 0.93),
        0.14,
      );
      this.ball(this.arms, skin, [side * 0.3, 1.2, 0.96], [0.16, 0.11, 0.2]);
      this.segment(
        this.root,
        ink,
        new THREE.Vector3(side * 0.3, 0.85, 0),
        new THREE.Vector3(side * 0.3, 0.65, 0.7),
        0.21,
      );
      this.segment(
        this.root,
        ink,
        new THREE.Vector3(side * 0.3, 0.65, 0.7),
        new THREE.Vector3(side * 0.3, -0.75, 0.78),
        0.17,
      );
      this.ball(this.root, ink, [side * 0.3, -0.77, 0.9], [0.22, 0.14, 0.34]);
      this.ball(this.root, wood, [side * 0.72, -0.05, -0.12], [0.06, 1.05, 0.06]);
    }
    this.ball(this.root, wood, [0, 1.1, -0.4], [0.85, 1.05, 0.1]);
    this.ball(this.root, wood, [0, 0.72, 0], [0.8, 0.1, 0.6]);
    for (const group of [this.head, this.eyes, this.torso, this.arms, this.root])
      mergeStaticParts(group, this.resources);
  }
  private material(color: string) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    this.resources.push(m);
    return m;
  }
  private ball(parent: THREE.Group, material: THREE.Material, p: number[], scale: number[]) {
    const mesh = this.mesh(parent, material, new THREE.SphereGeometry(1, 16, 12));
    mesh.position.set(p[0]!, p[1]!, p[2]!);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    return mesh;
  }
  private mesh(parent: THREE.Group, material: THREE.Material, geometry: THREE.BufferGeometry) {
    this.resources.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  }
  private curve(
    parent: THREE.Group,
    material: THREE.Material,
    points: THREE.Vector3[],
    radius: number,
  ) {
    return this.mesh(
      parent,
      material,
      new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(points[0]!, points[1]!, points[2]!),
        12,
        radius,
        6,
        false,
      ),
    );
  }
  private segment(
    parent: THREE.Group,
    material: THREE.Material,
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
  ) {
    const geo = new THREE.CapsuleGeometry(
      radius,
      Math.max(0.01, a.distanceTo(b) - radius * 2),
      4,
      12,
    );
    this.resources.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(mesh);
  }
  update(yaw: number, pitch: number, played: number, now: number) {
    this.yaw = yaw;
    this.pitch = pitch;
    if (this.lastPlayed !== undefined && this.lastPlayed !== played) this.gesture = now;
    this.lastPlayed = played;
  }
  animate(now: number, reduced: boolean) {
    const blend = reduced ? 1 : 0.2;
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, this.yaw, blend);
    this.head.rotation.x = THREE.MathUtils.lerp(
      this.head.rotation.x,
      NEUTRAL_LOOK_DOWN - this.pitch,
      blend,
    );
    this.torso.rotation.y = this.head.rotation.y * 0.12;
    this.torso.position.y = reduced ? 0 : Math.sin(now * 1.6 + this.phase) * 0.018;
    const blink = (now + this.phase) % 5.2;
    this.eyes.scale.y = !reduced && blink < 0.13 ? 0.12 : 1;
    this.arms.position.z = reduced
      ? 0
      : Math.sin(Math.min(1, Math.max(0, (now - this.gesture) / 0.6)) * Math.PI) * 0.3;
    return (
      (!reduced && now - this.gesture >= 0 && now - this.gesture < 0.6) ||
      Math.abs(this.head.rotation.y - this.yaw) > 0.002 ||
      Math.abs(this.head.rotation.x - NEUTRAL_LOOK_DOWN + this.pitch) > 0.002
    );
  }
  dispose() {
    this.resources.forEach((r) => r.dispose());
    this.root.removeFromParent();
  }
}
