# Durak experience direction: a cozy evening with friends

Status: proposed experience specification, 2026-10-21. The user selected this
atmosphere: warm light, tactile cards, relaxed banter, and moments of tension.
This document plans presentation; it does not claim the proposed lifecycle or
polish is already implemented.

## The central idea

You have pulled up a chair with your friends. The pressure travels clockwise.

The people, held cards and felt are the focus. Every accepted play changes the
table in a way everyone can follow. A successful defense passes the problem on;
a pickup gathers the accumulated story of that round into one hand. Quiet
moments let the friends' conversation lead.

The distinctive physical cue is a small **copper turn marker** that moves around
the table rim to the next authoritative active seat. It follows clockwise order,
including skipped escaped players, and settles beside the active player. A
readable name/action label accompanies it; color or motion alone never carries
the turn information. In reduced motion the marker changes position immediately.

## Art direction

- Keep the recognizable blue felt and traditional illustrated card faces.
- Retain the existing palette roles: midnight `#101e2c`, felt `#244e68`, walnut
  `#48312c`, copper `#c69c72`, ivory `#f3f0e6`, and pale blue `#a7d1e5`.
  Warmth comes primarily from the overhead light, wood, skin and sleeves.
- Give the table a soft pool of light, readable paper whites and contact shadows
  where the device budget permits. The surrounding room stays subdued. A few
  recognizable chair/room silhouettes establish a place without becoming a
  walkable environment or a collection of distractions.
- Use coherent materials: matte skin, cloth sleeves, wool felt, restrained wood
  grain and a modest satin card finish. Refine hand proportions and finger
  contact before adding environment detail. Preserve the user's smaller cards
  and first-person grip.
- Keep Instrument Serif for short titles and results; DM Sans for actions,
  instructions, names and counters. Gameplay wording is compact and direct.
- Spend copper on the turn marker and limited physical trim. Pale blue identifies
  actionable UI; warm warning color appears only when attention is necessary.

The current desktop has a large quiet area above the table; mobile gives too
much vertical space to interface chrome. Improve composition by reducing the
header/status footprint and giving the table and hand more usable space. Preserve
the seated viewpoint and the user's control of camera movement.

## How each moment should feel

| Moment        | Experience                     | Presentation                                                                                                                                                                               |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arrival       | Welcoming and immediate        | The table is already present. Invitation details, name/avatar and one clear action appear beside it or in a compact mobile sheet. The room is usable while cosmetic assets finish loading. |
| Taking a seat | Joining the group              | Your viewpoint settles into its seated position. Friends remain visible. A newly arrived avatar can make one small greeting gesture. The camera does not continue drifting afterward.      |
| Gathering     | Relaxed anticipation           | Occupied/empty seats, teams and readiness are clear. Settings recede after choices are made. A ready state is a small mark beside the person, supported by text.                           |
| Countdown     | Everyone is about to play      | Three quiet beats accompany the agreed three-second countdown. Cancellation is immediate and plainly explained.                                                                            |
| Opening       | A shared ritual                | Within the agreed four seconds: deal, reveal Huzur, show Suhuh, identify who starts. The interface gives these events space, then returns control.                                         |
| Your turn     | Clear agency                   | The turn marker settles at your seat; the short instruction changes to the action available. One gentle cue is enough.                                                                     |
| Selecting     | Tactile and deliberate         | Cards lift slightly; their identity remains readable. Selection stays local. The preview explains what will be played before confirmation.                                                 |
| Defending     | A small moment of tension      | Show which chosen card beats each incoming card. After acceptance, pairs meet on the felt and the pressure passes clockwise.                                                               |
| Picking up    | Consequence without punishment | Gather the actual table cards into the recipient's hand. A brief paper shuffle and count change explain the outcome.                                                                       |
| Escaping      | Relief while staying social    | A short acknowledgement at that seat; the player remains present and watches the rest of the game.                                                                                         |
| Results       | Shared banter and closure      | Cards settle, the relevant individual/team result appears, and avatars make restrained acknowledgements. Horse shows its letter progression. Ready for the next game stays easy to find.   |
| Reconnection  | Reassuring continuity          | Keep the seat visible, label temporary bot control, and quietly acknowledge the friend's return. Do not replay old actions as new celebrations.                                            |

## Touch, motion and pacing

Timing targets below are presentation targets to tune by eye, not game rules or
new delays before the server accepts input.

| Action                                | Initial target                                   |
| ------------------------------------- | ------------------------------------------------ |
| Button press feedback                 | 80–120 ms                                        |
| Card lift/selection                   | 120–180 ms                                       |
| Accepted play travelling to the table | 280–420 ms                                       |
| Defense pairing and continuation      | 350–500 ms, with a brief readable pairing moment |
| Pickup/discard gathering              | 400–550 ms                                       |
| Result acknowledgement                | About 800 ms; actions remain available           |

Use short ease-outs for feedback and smooth in/out travel for cards. Paper has
weight and slight flex; avoid elastic bounce, exaggerated spins and long
flourishes. Keep controls responsive during presentation. If a newer state
arrives, reconcile toward it instead of building a backlog of obsolete animations.

The player's camera stays under their control during play. Do not zoom or swing
it on each action. Avatars use small head/shoulder/hand movements triggered by
public events. Manual head turns stay visible to others. Hover, selection,
invalid attempts and private card choices never trigger remote tells.

Idle motion stays subtle and follows the existing low-rate mobile/desktop budget.
Reduced motion preserves information through static placements and brief fades;
mute preserves it through visual cues. A still frame must already communicate
the current game state.

## Sound underneath the call

The sound character is close paper, felt and wood: soft deal rustles, a card tap,
a short gathering shuffle, a gentle turn cue. Match sound to accepted actions and
visible arrivals. Avoid a separate sound for every card in a large mass; treat
the group as one event with small texture variation.

- Effects default to a quiet level after the user's first interaction. Provide
  persistent mute and effects-volume controls; save the preference locally.
- Music and ambient loops are off by default. Existing Discord/other calls lead.
- Give the local player one quiet warning at five seconds remaining. Do not tick
  or alarm every second. Keep the timer readable without flashing the scene.
- Use a short warm result cue, rather than a long victory/defeat jingle.
- Returning from a hidden tab must not play a backlog of missed sounds.
- Inspect the existing `packages/client/src/utils/audio.ts` before replacing it.
  Its synthetic cues are currently consumed by the retired GameBoard, not the
  active CardRoom. Reuse useful lifecycle behavior and audition the actual sound
  before deciding whether recorded/licensed paper samples are needed.

## Interface restraint and mobile composition

During play, the first questions answered are: **whose turn, what must be beaten,
which cards are mine, what can I do?** Keep secondary settings in the table menu.

On desktop, the table dominates, with a compact status line and an action dock
near the held hand. On mobile, use a compact header, table/hand, then a reachable
action dock with safe-area spacing. Fit portrait and landscape independently.
Do not shrink the hand to preserve unnecessary empty background.

Keep a small face-up Huzur reference with its rank and suit available to everyone;
tap/click to inspect it larger. Active attack references remain available when
the camera looks away. Never put a nameplate, counter or panel over a playable
card. Essential instructions and controls use readable type and at least 44px
touch targets; keyboard focus and card-selection states remain distinct.

Copy names the action: “Your turn”, “Choose your defense”, “Pick up 6 cards”,
“Waiting for Mina”, “Bot playing for Alex”. Counts come from live state. Let
friends supply the teasing: result copy acknowledges the Durak without inventing
insults or forcing a humiliating animation.

## Implementation sequence and review

### Character gestures added to the direction — 2026-10-22

The user requested manually chosen public gestures: show 1–4 fingers, touch the
nose, and touch either ear. Everyone sees them; they are not automated responses
to private cards. One hand supports the fan while the other gestures, and a
gameplay action takes priority over an emote. Preserve the existing camera and
manual head turns. Model/rig findings and the proposed gesture interaction are
recorded in [AVATAR_MODEL_RESEARCH.md](AVATAR_MODEL_RESEARCH.md). The user's
Quaternius Ultimate Modular Characters pack is the recommended first prototype;
this is a proposed replacement, not a completed integration.

1. **Composition and materials:** static desktop/mobile views, readable cards,
   consistent hands/avatars, compact HUD, and clear lighting.
2. **Signature interaction:** the turn marker plus one complete select/preview/
   confirm/defend/pickup sequence using stable card identities.
3. **Social rhythm:** apply the agreed gathering, countdown, opening, result,
   next-game and reconnect flow, keeping the same table mounted.
4. **Sound and restraint:** connect accepted events to effects, add saved audio
   controls, reduced-motion treatment and device quality checks.

Use the existing React/Three.js animation stack. This plan does not require an
additional motion framework. New presentation data must describe public events;
it must not expose private hands or drive authoritative game rules.

Review short recordings, not only screenshots: a 1v1 opening, a six-player
clockwise chain, a multi-card defense/pickup, Horse progression, a reconnect and
the next deal. Check muted and reduced-motion variants. Capture desktop,
portrait and landscape; validate gesture comfort and sustained performance on
physical phones before claiming device readiness.

Accept the direction when a new player can identify their next action within a
few seconds, a viewer can follow the clockwise chain without narration, the
hand/active cards remain readable, and ten minutes of play feels comfortable
under a real friends' call. Treat those as usability checks to perform, not
results already measured.

## Skills and boundaries

Used [Taste Skill / design-taste-frontend](https://github.com/Leonxlnx/taste-skill)
for subject-specific art direction, visual hierarchy, meaningful feedback and
rendered critique, alongside the existing frontend-design guidance. Its generic
page/dashboard layout recipes are not substitutes for the physical game scene.
The table/card ritual and custom clockwise rules supply the design's structure.

The previously agreed game-flow choices remain the foundation: private friends
first, persistent table, optional guided hand, all selected seats required,
automatic ready-based starts, explicit play confirmation, temporary bot takeover,
late arrivals watching until the next game, and existing calls for voice.

This pass installs the requested skill and records the proposed experience. It
does not modify game runtime code, add voice, or claim a completed visual build.
