# Avatar model and public gesture research

Inspected 2026-10-22. This research led to the implemented, selectable
[Casual prototype](CASUAL_AVATAR_PROTOTYPE.md). The findings below record the
source-asset inspection; runtime validation is documented with the prototype.

## Recommendation: the user's Ultimate Modular Characters pack

[Quaternius Ultimate Modular Men / Characters](https://quaternius.com/packs/ultimatemodularcharacters.html)
is the strongest first prototype for the current game. Its clothed, low-poly
characters fit the casual social table and provide a practical modular base.
The creator identifies it as CC0, with 11 characters, 24 animations and four
swappable parts per character. The pack dates to February 2022. Its illustrated
selection is male-presenting; a broader character selection remains future work.

The creator links to this
[public download folder](https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX).
I followed its **Humanoid Rig → Individual Characters → FBX** folder and
downloaded `Casual.fbx` directly for inspection. Research copies remain under
`output/avatar-models`, rather than the game's shipped assets.

### Actual Casual model findings

| Property                             | Local inspection                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Download size                        | 439,948 bytes (about 430 KiB)                                                                  |
| Triangles                            | 6,206 total: head 1,888; feet 512; body 3,048; legs 758                                        |
| Modular pieces                       | Four skinned meshes: head, feet, body, legs                                                    |
| Skin skeleton                        | 49 bones referenced by each mesh's skeleton; extra end nodes also exist                        |
| Fingers                              | 28 finger bones across both hands have nonzero vertex weights; all five digits are represented |
| Example joint names                  | `HandR`, `Index2R`, `Index3R`, `Index4R`, `Thumb2R`, `Thumb3R`, with left-hand equivalents     |
| Animation clips in this sampled file | None; the pack lists separate animation downloads                                              |
| Materials                            | 10 material slots across the four meshes, with sharing/merging to inspect before shipping      |

This establishes a usable finger rig, not a completed pose or deformation test.
We still need to author counting and face-touch poses. Touching a nose or ear
does not require animating those facial parts, but it does require locating the
contact point and correctly positioning the arm, wrist and fingertip.

Three.js `FBXLoader` reported vertices with more than four skinning influences
and discarded the extras. Preparation must explicitly normalize/prune weights
for the target renderer and visually check hands, elbows and shoulders. Export a
reviewed GLB for production, rather than depending on this research FBX import.
Check hair/outfit swaps on the same skeleton, seated deformation, six-avatar
draw calls and memory on physical phones.

Evidence: `output/avatar-models/ultimate-modular-casual.fbx.inspection.json`,
generated with `inspect-fbx.mjs`. The creator's preview is saved as
`output/avatar-models/ultimate-modular-preview.jpg`. Neither is an in-game render.

## Other candidates inspected

| Candidate                                                                                         | Strength                                                                                                                                      | Limitation for this project                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | More detailed stylized anatomy. The downloaded free male/female models each have 65 skin joints and weighted individual fingers.              | The free Standard archive actually contains **two superhero-proportion bodies**, not the full six bodies advertised across tiers. Casual clothing and proportion changes would still be needed. The Blender Source tier is separately paid. |
| [Open Source Avatars / 100Avatars](https://github.com/ToxSam/open-source-avatars)                 | Original 100Avatars collections are marked CC0; ready-made outfits and VRM humanoid mappings. Sampled files contain individual finger joints. | Very mixed character styles. Choose individual models rather than importing the whole catalog. Community collections have differing licenses.                                                                                               |
| [MakeHuman / MPFB](https://static.makehumancommunity.org/about/license.html)                      | Open-source character creation with CC0 core assets; a good longer-term route for editable human proportions and a broader avatar creator.    | A character-authoring pipeline, rather than an immediately matching finished cast. Core asset licenses do not establish the license of every community add-on. No generated model or mobile performance was tested here.                    |

Specific sampled assets:

- Universal Base Characters Standard male: **14,318 triangles**, 65 skin joints,
  40 weighted finger bones including leaf joints; three primitives, no animation
  clips or named facial morphs in the sampled glTF. Female: **15,060 triangles**,
  same skeleton/finger counts. These are body counts, excluding added hair/clothes.
- 100Avatars R1 `Robert`: **4,732 triangles**, 65 skin joints, one primitive,
  1,656,464-byte VRM. Its embedded metadata also states CC0. Visually, the bright
  character is a weaker fit for the current cozy human cast.
- 100Avatars R3 `Jenny`: **13,663 triangles**, 69 skin joints, one primitive,
  6,746,345-byte VRM with 12 named expression/blink/phoneme morphs. Embedded metadata
  states CC0. It is a stylized fish character, not a substitute for a casual human.

These counts come from the downloaded files, not estimates from promotional
screenshots. File size and triangle count alone do not establish mobile speed.
No candidate includes a verified ready-to-use package of the requested gestures.

## Gesture feature direction agreed with the user

Gestures are **public emotes selected manually**. Everyone can see the movement.
They are not automatically triggered by hidden cards or assigned secret meanings.

First set:

- Show 1: index finger.
- Show 2: index and middle fingers.
- Show 3: index, middle and ring fingers.
- Show 4: four fingers with the thumb folded.
- Touch nose.
- Touch left ear.
- Touch right ear.

Possible later additions: wave, nod, shrug and thumbs up. These should keep the
quiet, friendly tone rather than become constant autonomous reactions.

### Intended interaction and animation

- One **Gestures** control opens a labelled picker. Keyboard and touch choose
  the same named presets; an emote does not require holding a physical key.
- The free hand makes the gesture while the other supports the cards. Return
  smoothly to the card grip. Gameplay actions take priority and cancel the emote
  when necessary. Gesture motion must not block card selection or the action dock.
- Author a normalized pose/animation layer for each rig. Blend finger, wrist,
  elbow and shoulder motion over the seated idle. Preserve manual head movement.
- For nose/ear contact, use per-model offsets relative to the head and an arm
  IK/contact pass so the finger follows head turns without penetrating the face.
- Show the local free-hand motion where it is visible. Nose/ear contact may occur
  near the edge of the first-person view; use a small self-avatar preview in the
  picker to make the selected action understandable without moving the camera.
- Proposed initial timing: about 0.25 s in, 1.5 s hold, 0.25 s out, with a
  server-enforced three-second cooldown independent of gameplay rate limits.
- Synchronize an allowlisted gesture ID, start time and sequence through the
  authoritative room. Do not transmit arbitrary skeleton poses. Reconnecting or
  joining viewers may see the remainder of a current gesture; do not replay stale
  gestures. Preserve the existing private-hand filters.

### Prototype acceptance before adopting the pack

Use the Casual model for a seated prototype: one full-body peer avatar and the
corresponding first-person hand style. Demonstrate 1, 2, 3, 4, nose, left ear and
right ear while retaining a believable card grip. Inspect from across the table,
near the hand and on portrait mobile. Then test two clients, head turning during
contact, cancellation on play, cooldown, late joins, reduced motion, six seats
and teardown. Keep the current avatar available until this prototype is reviewed.

## Scope of this research pass

At the research cutoff, read publisher/license sources, inspected creator preview images, downloaded
actual sample assets, and inspected bone hierarchies, skin weights, triangles,
material slots and animation/morph metadata. No game runtime code, dependencies,
server schema or current avatar assets were replaced during that research pass.
The subsequent implementation and browser/pose checks are recorded in
[CASUAL_AVATAR_PROTOTYPE.md](CASUAL_AVATAR_PROTOTYPE.md). Physical-phone performance
remains unverified.
