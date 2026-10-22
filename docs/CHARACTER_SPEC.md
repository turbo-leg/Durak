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

## Clips

`idle`, `grip`, `play`, `pickup`, `draw` and `emote/<id>`. Clips are data in
`character/animations/clips/`; contact clips name socket targets and are completed by IK at
runtime. Add an emote with one clip file and one registry entry.

## Acceptance

Run the character tests (`src/test/character*.test.ts`): contract, proportions, grip
geometry against the real card fan in both views, and every clip sampled for finger
clearance, limb lengths and contact.
