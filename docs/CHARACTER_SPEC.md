# Durak character contract

One rig serves every seat, the local first-person view and every animation.
The source of truth is `packages/client/src/character/spec.ts`; this page explains it.

## Why a dedicated rig

The Quaternius Casual hands were 1.6× too large for the held cards and had a two-bone
thumb, so no thumb pinch could hold the fan without the cards cutting the hand. This rig
is sized around the card, so card actions (hold, play, pick up, draw) and emotes are
authored once and reused.

## Space and bind pose

- Metres, at real adult size (1.72 m stature). The scene draws everything at
  `CHARACTER_SCALE` (3.3 world units per metre), and the room shares those metres
  (`CharacterSpace.ts`):
  - an oval table 1.6 × 1.1 m and 74 cm high;
  - chairs 38 cm back from its edge, with a wooden chair under every other player;
  - jumbo cards, 1.5 × a 63.5 × 88.9 mm poker card (`CARD_SIZE` in `spec.ts`), one size
    for held, flying and table cards; the table layout grows with them;
  - the fan carried 40 cm in front of the eyes and 20 cm below them, drawn up 7 cm while
    the free hand reaches across under it (`CARRY_RAISE`).
- Seated bind pose, facing +Z, character's left on +X. Arms: upper arm down, forearm
  forward, hand forward with the palm toward the midline and the thumb up.
- Every bone's bind rotation is the identity. Clip rotations are therefore in
  world-aligned joint frames: "rotate `UpperArmR` about X" means the same thing on every
  character.
- The seated eyes are 76 cm above the seat (45 cm high). The first-person camera sits at
  the `Eyes` socket and the card carry frame (`carryMatrix`) hangs from it.

## Bones

`Root › Hips › Abdomen › Chest › Neck › Head (› HeadTop)`, and per side (`L`/`R` suffix):

- Arm: `Shoulder › UpperArm › LowerArm › Hand`
- Fingers: `Index1-3`, `Middle1-3`, `Ring1-3`, `Pinky1-3`, each ending in a `…Tip` leaf
- Thumb: `Thumb1` (metacarpal) `› Thumb2 › Thumb3 › ThumbTip`
- Leg: `UpperLeg › LowerLeg › Foot › Toe`
- Face (children of `Head`): `Eye`, `Lid`, `Brow`, `Mouth` (the mouth's corner); and one
  `Jaw`. Landmarks are `FACE` in `spec.ts`.

## Proportions (hard requirements)

| Measure                              |                Value (m) | Why                                  |
| ------------------------------------ | -----------------------: | ------------------------------------ |
| Card height / width                  |          0.1334 / 0.0953 | Jumbo: 1.5 × a poker card            |
| Stature; eyes above the seat         |               1.72; 0.76 | An average adult, seated             |
| Shoulder width; upper arm; forearm   |         0.38; 0.33; 0.26 | Real reach to the table centre       |
| Palm, wrist to middle knuckle        |                    0.108 | Real hand: 1.2 poker-card heights    |
| Middle finger                        | 0.086 (0.04/0.025/0.021) | Fingers wrap behind the fan's base   |
| Thumb (metacarpal, proximal, distal) |    0.046 / 0.032 / 0.026 | Three bones so the thumb opposes     |
| Finger / thumb radius                |          0.0085 / 0.0105 | A thin web: card edges fit the pinch |

## Sockets

Named empty nodes parented to bones: `Eyes`, `Nose`, `EarL`, `EarR` (on `Head`), `GripL/R`
(thumb pad, on `Thumb3`), `PalmL/R` (palm centre, on `Hand`). Contact animations target
sockets, never hard-coded coordinates.

## Mesh and appearance

A single skinned body mesh plus a head mesh (hidden in first person) and hair variants.
Each vertex carries a `_region` attribute (skin, shirt, trousers, shoes, hair, eye white,
iris, lip, belt, pupil, mouth). Where two regions meet the mesh has a hard edge (a sleeve cuff, the
waistband), not a blend. An appearance recolours regions and picks a hair variant, so all
characters share one asset. Weights are normalized, four influences at most; the visible
body, head and hair stay under 12,000 triangles.

## How the character moves

`character/CharacterPose.ts` builds every frame in the same order:

1. **Look:** the spine and head share the player's yaw and pitch; the camera sits at `Eyes`.
   Other players' heads turn on a critically damped spring, the torso following more
   slowly, and while seated they breathe, sway a little and their heads drift.
2. **Lean:** additive spine, head and shoulder rotations from active clips.
3. **Hold:** the right hand holds the whole fan by the lower corner of its front card, like
   a hand of cards held in one hand: the fan's base rests in the palm, the fingers wrap
   behind it and the thumb lies across the front card's face (`GRIP`, measured in that
   card's frame so the grip follows the fan as it widens). The hand is moved back behind
   every card it covers, and the thumb turns at its base until it rests on the frontmost
   face. The left hand rests and does the card actions and most gestures; when a gesture
   needs the right hand (touching the right ear) the left takes the fan over, arriving
   from below so the cards pass between thumb and fingers. Reactions such as crying use
   the free hand too while cards are held. Looking down, or toward the free hand, brings
   the fan down over that hand's place on the table, so the free arm lets down beside the
   hip, and further back as the look turns toward it.
4. **Clips:** arm keys are reach targets solved with two-bone IK (limbs never stretch; far
   targets stay low over the table at their own height), blended over the hold by the
   clip's fade. Motion follows a smooth curve through every key (`track`): it carries on
   through a waypoint and settles only at the ends, a hold or a turn back, never
   overshooting. Keys may place different parts of the hand; the placed point slides from
   one to the next. The hand's turn travels as a rotation, and a moving hand's elbow
   follows it (away from the thumb, behind the fingers, steadied out and down), so the
   bend never flips. A clip steers its own path with waypoints: face touches lift straight
   up in front of the chest (behind any held fan), the index straightening on the way,
   meet the face as the head leans in, rub or tug twice, and return the same way;
   card actions lift off the table's edge, and a played card rides in the hand until it is
   set down (`PLAY_RELEASE_MS`).
5. **The table:** the table is solid (`TABLE_LAYERS` and `tableClearance` in
   `CharacterSpace.ts`, the same shape `TableRenderer` draws). A free hand that would pass
   into it comes to rest on it instead: the whole hand, keeping its turn and shape, moves
   up onto the top or back off the edge, whichever is shorter. A fan held low enough for
   its hand to meet the table is raised straight up until it clears (`fanLift`), and the
   rig raises the drawn cards as far.
6. **The face:** the iris and pupil slide over the eyeball as the eyes look; a skin lid
   rolls down over each eye; the brows lift and tilt; the lips' corners rise or fall, and
   the lower lip drops with the jaw to show the mouth inside. Clip keys carry an
   `Expression` (`smile`, `open`, `brows`, `worry`, `squint`, `gazeX`, `gazeY`), blended
   by clip weight like everything else. Over it, a living rest: the faintest smile, a
   blink every two to six seconds (sometimes a double), small darting looks, and eyes that
   lead the head into a turn (`gaze`). Looking down lowers the lids a little.

## Clips and the registry

Clips are data (`character/animation.ts`). A key gives, per arm, a reach `target`
(`body`, a head socket, or a runtime target such as `table` or `deck`), an `effector`
(`Wrist`, `IndexTip`, `Palm`), finger and thumb-side directions, and a hand shape (per-finger
curl, spread, thumb fold); plus optional additive `bones` rotations. `mirrorClip` performs a
clip with the other hand.

`character/animations/registry.ts` holds three kinds:

| Kind        | Triggered by                                      | Examples                               |
| ----------- | ------------------------------------------------- | -------------------------------------- |
| `EMOTES`    | A public gesture (server-validated, rate limited) | counts, nose, ears, cry, cheer, shrug  |
| `ACTIONS`   | Public table events (`game/tableEvents.ts`)       | play, pickup, draw                     |
| `REACTIONS` | Local, from public game results                   | cry for the durak, victory for winners |

### Add an emote

1. Write the clip in `registry.ts` and add it to `EMOTES` under a new id.
2. Add `{ id, label }` to `GESTURES` in `packages/shared/src/presence.ts`, so the server
   accepts it and the picker lists it. A test fails until both lists match.
3. Preview it: `npm run dev:client`, open `/character.html`, choose the clip,
   card count, view and character. `?clip=emote:<id>&at=<ms>` freezes a moment.
4. Run `npm test -w @durak/client`: every emote is sampled for limb
   length, finger spacing and hands kept outside the head.
5. Optionally `npm run character:shots` to screenshot every clip at its peak.

Actions and reactions work the same way, triggered from `TableRenderer.actOut`.

## Regenerate or replace the model

`npm run character:build` regenerates `public/models/character/base.glb` from
`spec.ts` and `generate.ts`; the contract test fails if the shipped GLB is stale. An
artist-made GLB can replace it if it keeps the bone names, identity bind rotations, sockets,
`_region` attribute and the proportions above; the same tests then verify it.

## Acceptance

`src/test/characterContract.test.ts` and `src/test/characterPose.test.ts` check the real GLB:
the contract and proportions; the grip against the rendered fan (1, 2, 3, 5 and 7 cards and
12 cards on a narrow screen; centre and both gaze limits; first person and peer) with no
skin through a card, thumbs resting on faces, fingers straight and apart and hands apart;
every gesture's contact; every emote, reaction and action for limb length, finger spacing,
head clearance, an undisturbed holding hand and no skin through the held fan; and, from the
near, side and far chairs, no hand or forearm skin inside the table at rest (every gaze, 0 to
7 cards, with a clean grip on a raised fan) or through any emote, reaction or card action.
`src/test/characterFace.test.ts` checks that open eyes show their pupils and shut lids cover
them, that pupils stay on the eyeball at every gaze, that smiles and frowns move the corners,
that the mouth hides its inside until it opens, and that blinks are brief and every few seconds.

## Review screenshots

Rendered with the real `TableRenderer` and shipped GLB (taken before the switch to real
proportions; regenerate them to see today's sizes):

- [The player's own view](character/grip-player-view.jpg): one and five cards, both 65° head
  turns, and a 390×844 phone with five and twelve cards.
- [Other players' view](character/grip-other-players-view.jpg): one, five and seven cards, a
  turned head, and close-ups of the index finger behind the card and the thumb pad on its face.
- [Gestures](character/gestures.jpg), [emotes](character/emotes.jpg) and
  [card actions](character/card-actions.jpg).
