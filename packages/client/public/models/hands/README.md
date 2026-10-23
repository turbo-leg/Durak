# Generic hand meshes

`left.glb` and `right.glb` are the unmodified generic hand assets used by Three.js
`XRHandMeshModel`. They are vendored here so normal desktop/mobile games do not
depend on a third-party CDN or an XR session.

Source: `@webxr-input-profiles/assets@1.0.0`,
`dist/profiles/generic-hand/{left,right}.glb`, downloaded from jsDelivr.
Upstream: https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets/profiles/generic-hand

The package's MIT license is retained in `LICENSE.md`.
Runtime card-grip posing, preset materials and sleeves live in
`src/components/three/FirstPersonHands.ts`. Joint transforms in these assets are
siblings, not finger-parent hierarchies; the posing code accounts for this.
