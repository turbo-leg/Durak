# Casual avatar and public gestures

> **Superseded.** The Quaternius Casual rig, its procedural stand-ins and the first-person
> hand assets were retired in favour of one purpose-built character. See
> [CHARACTER_SPEC.md](CHARACTER_SPEC.md). This page is kept as a record of the prototype.

Implemented 2026-10-22. This is a selectable prototype for review before adopting
the character pack across the whole cast.

## Try it

Open the local game, choose **Casual** under **Your character**, then open
**Gestures**. The welcome screen provides a local rehearsal. At a table, gestures
are public to players and spectators. Appearance changes remain available in the
waiting room. The original four characters remain selectable; they show public
gesture text, while Casual also performs the articulated pose.

Available gestures: one, two, three or four long fingers; touch nose; touch left
ear; touch right ear. The thumb folds across the palm for counts. Ear labels mean
the character's own left and right. The small front-view mirror makes face contact
visible to the person performing it. Escape closes the picker and returns focus.

## Implementation

- Quaternius Casual supplies the seated body and matching first-person arms.
  The four modular skinned parts and all finger joints are retained. Head movement
  follows the existing public gaze, with smoothing; contact targets follow the
  posed head. The opposite hand keeps its grip. Empty-handed peers rest their hands.
- Analytic two-bone IK rotates shoulders/elbows and hips/knees without stretching
  limbs. Finger poses blend into the existing grip over 250 ms, hold for 1.5 s,
  and blend back over 250 ms. Reduced motion uses static poses.
- `gesture` messages contain an allowlisted `id`. The room derives ownership from
  the connection, validates human seats and phase, stamps server time and increments
  a public sequence. A separate three-second cooldown does not consume gameplay
  or gaze rate limits. Spectators cannot initiate gestures.
- Accepted attacks, defenses, pickups and Huzur swaps cancel the pose. Round reset
  clears it. A room-clock timer expires the public ID after two seconds; stale
  timers cannot clear a newer sequence. Late viewers and delayed asset loads use
  the original timestamp, rather than replaying an expired pose.
- Snapshots copy only public gesture values and the existing local private hand.
  No skeleton arrays or hidden-card-dependent signals are transmitted. Public text
  remains visible in 2D and is announced for assistive technology.
- Peer asset failure retains a procedural character. Late model loads after
  disposal release their geometry, materials and skeletons. Closing the mirror
  releases its separate small WebGL context. Gesture motion does not enter the
  card-picking raycast.

Primary files: `presence.ts`, `Player.ts`, `DurakRoom.ts`, `tableSnapshot.ts`,
`CasualPose.ts`, `CasualAvatar.ts`, `GesturePreview.tsx`, `GesturePicker.tsx`,
`TableRenderer.ts`, `AvatarPicker.tsx` and `CardRoom.tsx`.

## Assets and reproduction

Source: [Quaternius Ultimate Modular Characters](https://quaternius.com/packs/ultimatemodularcharacters.html),
Humanoid Rig / Individual Characters / FBX / Casual.fbx, CC0 1.0 Universal.
Source and full license are recorded in `packages/client/public/models/casual/`.
The sampled FBX has no animation clips: these poses are authored by Durak.

Run `node scripts/prepare-casual-avatar.mjs path/to/Casual.fbx`. The script
consolidates FBX identity-child joint copies, normalizes four-influence skin
weights, converts materials and indexes identical vertices without changing
normals or triangle count. The cropped arm export removes unused body vertices.

| Shipped asset  |            Size |
| -------------- | --------------: |
| `casual.glb`   |   850,048 bytes |
| `arms.glb`     |   320,920 bytes |
| Full character | 6,206 triangles |

The FBX loader reduces vertices with more than four influences to four; the
resulting deformation was checked in the browser. These optimizations reduced
the original two GLB exports from roughly 1.8 MB to 1.17 MB combined.

## Validation

Final checks: root `npm run test` passes all **396 tests** (157 client, 173 server,
66 shared); `npm run typecheck`, `npm run lint` and `npm run build` pass. Vite
retains its native-config compatibility notice and large lazy scene chunk warning;
the server test run also reports the existing Mongoose deprecation notice.

- Automated pose checks load the actual shipped GLB: unique joint names,
  normalized weights, original triangle count, distinct finger counts, preserved
  limb lengths and supporting hand, and fingertip contact within 0.04 normalized units
  of head anchors across left/center/right gaze. Late-load teardown is covered for
  body and arms. Public timeline checks cover stale and reduced-motion poses.
- Real Colyseus tests cover sender ownership, invalid IDs, spectator rejection,
  rate isolation, late-join timestamps, expiration, and cancellation on an accepted
  play while a rejected play leaves the emote alone.
- React tests cover named messages, cooldown, spectator controls, peer text,
  keyboard dismissal and focus restoration.
- Two real browser players created/joined a private table, observed all seven
  gestures on the peer, readied/dealt, changed view and observed a live-game emote.
  No page errors were reported. Screenshots: `output/playwright/casual-peer-*.png`,
  `casual-live-nose.png` and `casual-live-peer.png`.
- Touch-enabled browser emulation at 390×844 checks the picker, reduced motion,
  44 px gesture targets, no horizontal overflow and teardown into 2D (zero canvases).
  The 844×390 landscape picker was corrected to remain inside the viewport and
  scroll if needed. Screenshots: `casual-mobile-*.png`, `casual-landscape-gesture.png`.
- A six-seat renderer fixture loads five Casual peers plus the local matching
  hands and preserves the card fan. It is a presentation fixture, not a six-human
  network match. After the size adjustment below, the development renderer reported 387 scene draw calls, including
  cards and other scene work; physical-phone cost has not been measured.

## Remaining before wider adoption

Physical iOS/Android and embedded Discord acceptance; profiling and reducing the
six-seat scene cost; more character identities and customization; further wrist,
thumb and sleeve refinement at close range. Other original presets currently
provide textual emotes only. The production build retains a large lazy Three.js
chunk warning. This milestone does not claim final animation quality or phone
performance approval.

## Character size feedback

Seated players now render at 1.6× their original scale, growing around the held-card
height so the fan remains aligned with the grip. Remote card fans and name labels
follow the larger seated proportions. The character mirror is wider and framed
closer to show the face and gestures clearly. First-person card and hand scale is
unchanged. Reviewed two-seat and six-seat scenes, portrait/landscape picker layouts
and contact posing; targeted tests, root type checks/lint and the client production
build pass.
