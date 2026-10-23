# Social table: first playable avatar milestone

Implemented 2026-10-21. The accepted direction is seated first person, stylized people, visible hands/sleeves, four presets, and avatars before voice.

## What is playable

- Copper, Sage, Indigo and Ochre share modular character proportions, interchangeable appearance parts and a common head/arm hierarchy. No paid assets or external model requests are required.
- Avatar choice is saved locally, sent on every join path (including Discord auto-join), and changeable while waiting. Appearance changes during play are rejected by the server.
- The camera stays at the player's chair. Drag empty space or use arrow keys to look; Home and Recenter restore the forward view. Card picking takes priority over camera dragging.
- Other players see head turns and subtle shoulder movement, with interpolation, breathing and blinking. Bots attend to the active seat. Hands gesture after an accepted play; selecting or rejecting cards does not announce a play.
- Local hands/sleeves support the private card fan. Remote avatars show only card backs and public counts. Spectators keep an overview camera and do not occupy a chair or send presence.
- Private setup has 1v1, 2v2, 3v3 and free-for-all shortcuts, retaining 2–6 classic seats, Horse, five/seven-card hands and existing team rules. Seating follows authoritative clockwise order with alternating teams.
- Mobile portrait and compact landscape layouts, accessible card controls, reduced motion and WebGL fallback are supported. The home scene previews a six-seat table.
- Active attacks sit farther from the held fan and tilt toward the viewer. A persistent active-card reference beside the play controls keeps ranks and suits readable when looking away; it fits seven cards on narrow screens.

## Protocol and rendering

`Player` adds public `avatarPreset`, `headYaw`, `headPitch` and `playSequence`. `look { yaw, pitch }` is connection-bound, finite-validated, clamped to ±65° yaw and −25°/+20° pitch, and accepted at most once per 100ms per player. Its budget is separate from gameplay messages. `avatarPreset { preset }` accepts only registered presets in the lobby. Disconnect resets head direction and its rate state.

`playSequence` increments only after an attack or defense is accepted. The snapshot copies presentation values without adding opponent hands or private identifiers to the renderer. Preset persistence is local; no inventory/account migration is required. Client and server must be deployed together because the Colyseus schema changed; existing in-memory rooms should be drained/restarted during rollout.

The rendering is split between `TableRenderer`, `SeatedView` and `AvatarRig`. Parts moving together are merged by material. Card edge faces share a geometry group; face-down piles use a single material. Labels are rebuilt only when label content changes, rather than on head packets. Avatar resources and input listeners are disposed on teardown. Narrow views are paced toward 30 FPS; idle animation stops for hidden tabs and reduced motion. Development-only data attributes expose draw calls and resource counts for QA.

## Validation

- Tests: client 112, server 142, shared 66 — 320 passing across the completed checks. Includes real Colyseus tests for presets, malformed/spoofed gaze, clamping, flood isolation, spectator restrictions, privacy and accepted-play counters; client coverage checks formats, presets, all 2–6 seat orders and seven-card attack references.
- ESLint, all-workspace TypeScript checks and production builds pass. Existing Vite config-migration and Three.js chunk-size warnings remain.
- Two isolated browser sessions: private create/join/ready/start, different presets, remote head turning, recenter, card selection and confirmed play.
- Browser format checks: 2v2 with three bots, 3v3 with five bots, three-player free-for-all; looked around the six-seat table and exercised leaving/rejoining.
- Chromium viewport checks: 1280×900 and 1440×900 desktop, 390×844 portrait, 844×390 landscape. No horizontal document overflow or application exceptions in the final two-client run.
- One two-player view fell from 228 to 75 measured draw calls after geometry/material consolidation. The six-seat view measured 167 calls in a sampled view; counts vary with view direction, piles and card count.
- A portrait browser sample rendered 27 frames in one second, near the 30 FPS target. This is a desktop browser measurement, not a physical-phone performance guarantee.
- Reduced motion produced zero idle render frames during a 500ms observation. Forced WebGL context loss switched to playable 2D controls.
- Screenshots and browser scripts are in ignored `output/playwright/avatar-*`; unit/network check output is in `output/avatar-tests.log`.

## Still outside this milestone

Physical iOS/Android GPU, touch and thermal validation, and an actual embedded Discord-client run, remain release checks. No webcam tracking, voice service, spatial voice, cosmetic editor, account-wide inventory or commercial character models are included. Next steps are visual review of the procedural avatars, quick social reactions, then Discord speaking indicators and a separate voice feasibility decision.

Skills used: frontend-design, Playwright, and CloudAI-X Three.js fundamentals, interaction, animation, geometry, lighting and performance. They informed the scene hierarchy, bounded input, merged geometry, resource cleanup and measured rendering changes.

## Model refinement

The procedural characters now use shaped jaw meshes, smaller eyes with irises/catchlights, curved smiles, fitted shoulder/waist profiles, collars, rounded limb joints and cohesive hair caps. The initial first-person hands used procedural thumb/finger segments; these were subsequently replaced by skinned assets (below). Shared pivots, presets and multiplayer head movement remain compatible.

Reviewed all four characters in `output/playwright/models-studio-current.png` against `models-studio-before.png`, then repeated the two-client browser check: no application exceptions, head movement, selection/play, portrait/landscape, seven-card references, reduced motion and context-loss fallback passed. A sampled two-player view measured 81 draw calls and 14 textures; the portrait sample rendered 28 frames per second. Client lint, TypeScript and build passed. Physical-phone performance remains unverified.

Blender modeling/export skills were investigated, but Blender and its modeling connection were not found in the current environment. No Blender skill or desktop application was installed for this pass; the existing Three.js skills cover these procedural changes.

## Skinned first-person hands

Replaced the procedural first-person palms/fingers with the actual left/right generic-hand GLBs used by Three.js `XRHandMeshModel`. `FirstPersonHands.ts` loads and poses these through `GLTFLoader`: the XR wrapper expects tracked joint input, whereas desktop/mobile play needs an authored card grip. No XR session, headset, camera permission or runtime third-party CDN is required.

Both unmodified assets (189 KB combined) and their MIT license/source notice are in `packages/client/public/models/hands`. Preset skin and sleeve colors remain supported. Fingers curl behind the fan and thumbs oppose its lower front edge. The assets have sibling joints, so bends move and rotate the downstream joints explicitly. Async completion after teardown disposes the loaded resources; asset failure leaves the cards playable. A load completion requests a render even with reduced motion enabled.

The user's photographic grip reference informed the next pose pass: larger hands cradle the outside corners, the right grip sits slightly higher, wrists turn inward, and the thumb bases wrap around the edges toward the faces. Grip spacing now follows the card count so the hands close in as the fan shrinks. The supplied stock image is a visual reference only and is not shipped as a game asset.

The revised grip removes the individual thumb-joint translations that stretched the thumb web. Thumb opposition and finger curls now use rotations around joint pivots, preserving segment lengths. Left and right wrist angles differ to reproduce the supporting left thumb and higher right pinch. A four-ten close-up matching the reference is captured in `output/playwright/grip-preview.png`; one/seven-card renders are visual fixtures. Held cards retain the requested 80% scale. Client build/typecheck, lint and the two-client desktop/mobile interaction check pass after this revision.

Visual checks covered the bare posed hands and the held fan. The final two-client browser run had no application exceptions and passed selection/play, peer head movement, recenter, portrait/landscape, seven-card HUD fit down to 320 px, reduced-motion idle rendering and WebGL fallback. Sampled two-player rendering: 79 calls, 26 geometries, 16 textures; portrait pacing: 28 frames in one second on desktop Chromium. Client lint, TypeScript and production build pass; Vite's existing config warning remains. The lazy Three.js chunk is now 170 KB gzipped including the GLTF loader. Physical mobile validation is still pending.
