# Durak character contract

One rig serves every seat, the local first-person view and every animation.
The source of truth is `packages/client/src/character/spec.ts`; this page explains it.

## Why a dedicated rig

The Quaternius Casual hands were 1.6× too large for the held cards and had a two-bone
thumb, so no thumb pinch could hold the fan without the cards cutting the hand. This rig
is sized around the card, so card actions (hold, play, pick up, draw) and emotes are
authored once and reused.

## Space and bind pose

- Normalized character units; the table draws characters at `CHARACTER_SCALE` (1.6).
- Seated bind pose, facing +Z, character's left on +X. Arms: upper arm down, forearm
  forward, hand forward with the palm toward the midline and the thumb up.
- Every bone's bind rotation is the identity. Clip rotations are therefore in
  world-aligned joint frames: "rotate `UpperArmR` about X" means the same thing on every
  character.
- The `Head` pivot and the `Eyes` socket match the previous camera exactly, so the seated
  view and the card carry frame (`carryMatrix`) do not move.

## Bones

`Root › Hips › Abdomen › Chest › Neck › Head (› HeadTop)`, and per side (`L`/`R` suffix):

- Arm: `Shoulder › UpperArm › LowerArm › Hand`
- Fingers: `Index1-3`, `Middle1-3`, `Ring1-3`, `Pinky1-3`, each ending in a `…Tip` leaf
- Thumb: `Thumb1` (metacarpal) `› Thumb2 › Thumb3 › ThumbTip`
- Leg: `UpperLeg › LowerLeg › Foot › Toe`

## Proportions (hard requirements)

| Measure                              |               Value | Why                                  |
| ------------------------------------ | ------------------: | ------------------------------------ |
| Held card height / width             |        0.18 / 0.123 | The fan as rendered                  |
| Palm, wrist to middle knuckle        |                0.17 | About one card high                  |
| Middle finger                        |               0.156 | Fingers fit behind a card            |
| Thumb (metacarpal, proximal, distal) | 0.068 / 0.05 / 0.04 | Three bones so the thumb opposes     |
| Finger / thumb radius                |     0.0155 / 0.0175 | A thin web: card edges fit the pinch |

## Sockets

Named empty nodes parented to bones: `Eyes`, `Nose`, `EarL`, `EarR` (on `Head`), `GripL/R`
(thumb pad, on `Thumb3`), `PalmL/R` (palm centre, on `Hand`). Contact animations target
sockets, never hard-coded coordinates.

## Mesh and appearance

A single skinned body mesh plus a head mesh (hidden in first person) and hair variants.
Each vertex carries a `_region` attribute (skin, shirt, trousers, shoes, hair, eye white,
iris, lip). An appearance recolours regions and picks a hair variant, so all characters
share one asset. Weights are normalized, four influences at most.

## How the character moves

`character/CharacterPose.ts` builds every frame in the same order:

1. **Look:** the spine and head share the player's yaw and pitch; the camera sits at `Eyes`.
2. **Lean:** additive spine, head and shoulder rotations from active clips.
3. **Hold:** the right hand holds the whole fan by the lower corner of its front card, like
   a hand of cards held in one hand: the fan's base rests in the palm, the fingers wrap
   behind it and the thumb lies across the front card's face (`GRIP`, measured in that
   card's frame so the grip follows the fan as it widens). The hand is moved back behind
   every card it covers, and the thumb turns at its base until it rests on the frontmost
   face. The left hand rests and does the card actions and most gestures; when a gesture
   needs the right hand (touching the right ear) the left takes the fan over, arriving
   from below so the cards pass between thumb and fingers.
4. **Clips:** arm keys are reach targets solved with two-bone IK (limbs never stretch; far
   targets stop at a natural extension), blended over the hold by the clip's fade.

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
3. Preview it: `npm run dev -w @durak/client`, open `/character.html`, choose the clip,
   card count, view and character. `?clip=emote:<id>&at=<ms>` freezes a moment.
4. Run `npx vitest run src/test/characterPose.test.ts`: every emote is sampled for limb
   length, finger spacing and hands kept outside the head.
5. Optionally `node scripts/character-preview.mjs` to screenshot every clip at its peak.

Actions and reactions work the same way, triggered from `TableRenderer.actOut`.

## Regenerate or replace the model

`node scripts/build-character.mjs` regenerates `public/models/character/base.glb` from
`spec.ts` and `generate.ts`; the contract test fails if the shipped GLB is stale. An
artist-made GLB can replace it if it keeps the bone names, identity bind rotations, sockets,
`_region` attribute and the proportions above; the same tests then verify it.

## Acceptance

`src/test/characterContract.test.ts` and `src/test/characterPose.test.ts` check the real GLB:
the contract and proportions; the grip against the rendered fan (1, 2, 3, 5 and 7 cards and
12 cards on a narrow screen; centre and both gaze limits; first person and peer) with no
skin through a card, thumbs resting on faces, fingers straight and apart and hands apart;
every gesture's contact; every emote, reaction and action for limb length, finger spacing,
head clearance and an undisturbed holding hand.

## Review screenshots

Rendered with the real `TableRenderer` and shipped GLB:

- [The player's own view](character/grip-player-view.jpg): one and five cards, both 65° head
  turns, and a 390×844 phone with five and twelve cards.
- [Other players' view](character/grip-other-players-view.jpg): one, five and seven cards, a
  turned head, and close-ups of the index finger behind the card and the thumb pad on its face.
- [Gestures](character/gestures.jpg), [emotes](character/emotes.jpg) and
  [card actions](character/card-actions.jpg).
