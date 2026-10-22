// Generate the Durak character GLB from packages/client/src/character (Node 24 runs the
// TypeScript directly). Usage: node scripts/build-character.mjs
import fs from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { generateCharacter } from '../packages/client/src/character/generate.ts';

// GLTFExporter reads Blobs through FileReader, which Node does not provide.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const target = 'packages/client/public/models/character';
const character = generateCharacter();
const glb = await new GLTFExporter().parseAsync(character, { binary: true, onlyVisible: false });
await fs.mkdir(target, { recursive: true });
await fs.writeFile(`${target}/base.glb`, Buffer.from(glb));
let triangles = 0;
character.traverse((node) => {
  if (node.isMesh) triangles += node.geometry.index.count / 3;
});
console.log(`${target}/base.glb: ${glb.byteLength} bytes, ${triangles} triangles`);
