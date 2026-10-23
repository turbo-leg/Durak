# Casual character prototype

Author: Quaternius. Pack: Ultimate Modular Characters.

Source: https://quaternius.com/packs/ultimatemodularcharacters.html
Official download: https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX
Source file: Humanoid Rig / Individual Characters / FBX / Casual.fbx

License: CC0 1.0 Universal (see LICENSE.txt).

`casual.glb` contains the four original skinned character parts and finger bones.
`arms.glb` retains forearm and hand triangles from the same character, with the
same skeleton. Both are normalized to 3.6 units standing height, use converted
rough standard materials and normalized four-influence skin weights. The FBX
loader reduces vertices with more than four weights to four influences.
Identity child copies of FBX joints are consolidated into one shared hierarchy
before export. `portrait.png` is rendered from the shipped model for the picker.
Identical vertices are indexed without changing normals, weights or triangle count;
the arm export also drops unused body vertices.

No animation clips are included in this individual-character FBX. Durak supplies
seated posing, gaze, grip and manual gestures at runtime; these are a prototype,
not Quaternius-authored animation clips.

Rebuild with `node scripts/prepare-casual-avatar.mjs path/to/Casual.fbx`.
