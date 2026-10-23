// Rebuild the prototype from Quaternius's CC0 Humanoid Rig/Individual Characters/FBX/Casual.fbx.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;
      this.onloadend?.();
    });
  }
};
const source = process.argv[2] ?? 'output/avatar-models/ultimate-modular-casual.fbx';
const target = 'packages/client/public/models/casual';
const buffer = await fs.readFile(source);
const model = new FBXLoader().parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  '',
);
// FBXLoader adds identity child copies of each bone for additional skinned parts.
// Export one shared hierarchy; glTF name deduplication otherwise hides the real pivots.
const canonicalBones = new Map();
const duplicates = [];
model.traverse((object) => {
  if (!object.isBone) return;
  if (canonicalBones.has(object.name)) duplicates.push(object);
  else canonicalBones.set(object.name, object);
});
model.traverse((object) => {
  if (!object.isSkinnedMesh) return;
  object.skeleton = new THREE.Skeleton(
    object.skeleton.bones.map((bone) => canonicalBones.get(bone.name)),
    object.skeleton.boneInverses.map((matrix) => matrix.clone()),
  );
});
duplicates.forEach((bone) => bone.removeFromParent());
const box = new THREE.Box3().setFromObject(model);
const wrapper = new THREE.Group();
wrapper.name = 'Casual';
wrapper.scale.setScalar(3.6 / box.getSize(new THREE.Vector3()).y);
model.position.y -= box.min.y;
wrapper.add(model);
model.traverse((object) => {
  if (!object.isMesh) return;
  if (object.isSkinnedMesh) object.normalizeSkinWeights();
  // Preserve authored normals and skin attributes while deduplicating identical vertices.
  object.geometry = mergeVertices(object.geometry, 1e-6);
  const convert = (material) =>
    new THREE.MeshStandardMaterial({
      name: material.name,
      color: material.color,
      roughness: 0.9,
      metalness: 0,
    });
  object.material = Array.isArray(object.material)
    ? object.material.map(convert)
    : convert(object.material);
});
await fs.mkdir(target, { recursive: true });
const exporter = new GLTFExporter();
const exportModel = async (root, name) => {
  const glb = await exporter.parseAsync(root, { binary: true, onlyVisible: false });
  await fs.writeFile(path.join(target, name), Buffer.from(glb));
};
await exportModel(wrapper, 'casual.glb');
// First-person arms use the same model/skin. Retain triangles weighted to arm/hand bones.
const arms = clone(wrapper);
const remove = [];
arms.traverse((object) => {
  if (!object.isMesh) return;
  if (!object.name.endsWith('_Body')) {
    remove.push(object);
    return;
  }
  const geometry = object.geometry.clone();
  const index = geometry.index;
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  const armBones = new Set(
    object.skeleton.bones.flatMap((bone, i) =>
      /LowerArm|Hand|Index|Middle|Ring|Pinky|Thumb/.test(bone.name) ? [i] : [],
    ),
  );
  const armVertex = (vertex) => {
    let weight = 0;
    for (let part = 0; part < 4; part++)
      if (armBones.has(skinIndex.getComponent(vertex, part)))
        weight += skinWeight.getComponent(vertex, part);
    return weight > 0.8;
  };
  const indices = [];
  const groups = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: index?.count ?? geometry.attributes.position.count, materialIndex: 0 }];
  geometry.clearGroups();
  for (const group of groups) {
    const start = indices.length;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const vertices = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset));
      if (vertices.every(armVertex)) indices.push(...vertices);
    }
    geometry.addGroup(start, indices.length - start, group.materialIndex);
  }
  geometry.setIndex(indices);
  object.geometry = mergeVertices(geometry, 1e-6);
});
remove.forEach((object) => object.removeFromParent());
await exportModel(arms, 'arms.glb');
wrapper.updateMatrixWorld(true);
const names = [
  'Hips',
  'Head',
  'UpperArmR',
  'LowerArmR',
  'HandR',
  'Index2R',
  'Middle2R',
  'Pinky2R',
  'Thumb2R',
];
console.log(
  names.map((name) => {
    const bone = wrapper.getObjectByName(name);
    return {
      name,
      position: bone.getWorldPosition(new THREE.Vector3()).toArray(),
      quaternion: bone.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    };
  }),
);
console.log(`Exported normalized full-body and first-person arms to ${target}`);
