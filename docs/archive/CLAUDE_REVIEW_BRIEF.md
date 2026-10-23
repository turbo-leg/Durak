# Durak review brief for Claude

Prepared 2026-10-21 for a review of the current local working tree.

**Follow-up:** The user's review has now been implemented in a correction pass.
Read [CLAUDE_REVIEW_RESPONSE.md](CLAUDE_REVIEW_RESPONSE.md) for current changes,
validation and remaining limits. The latest-work description below records the
state presented to the original review; several details are now superseded.

## Review request

Review this project as an independent technical reviewer. Start with findings,
ordered by severity, with file/line references, a concrete failure scenario,
and a recommended correction. Distinguish confirmed defects from suspicions
and visual preferences. Identify missing acceptance evidence. Do not rewrite
the application or change game rules during this review. Leave implementation
to a subsequent explicitly requested pass.

Repository: https://github.com/turbo-leg/Durak.git
Local checkout: `C:\Users\tubul\Documents\primis-finish-gaps\Durak`.

**Review the local checkout, including untracked source files and assets.** There
is substantial uncommitted work; a GitHub-only review or `git diff` alone misses
the new active frontend. Preserve all existing work. Do not reset, clean, delete,
install dependencies, or start competing development servers for this review.
Existing development URLs are normally client `http://localhost:5173` and server
`http://localhost:2567`; verify availability before using them.

## Product direction and constraints

The product is a playable, social, Three.js multiplayer Durak table for desktop,
mobile and eventually a Discord Activity. The server remains authoritative.
The user requested a replacement frontend and then seated avatars, visible peer
head turns, and first-person hands holding a small curved fan of cards. The hand
moves with the camera while the table remains in world space. Review the actual
result visually as well as reading code; hand proportions and the grip have had
several subjective revisions.

Formats include 1v1, 2v2, 3v3 and 2–6-player free-for-all. Preserve existing Horse
and team rules. Full avatar customization, voice and spatial audio are future
work, not implemented features.

This uses custom Durak rules. Read `GAME_RULES.md`, `GAME_NOTATION.md`, the shared
engine and its tests before suggesting rule changes. The deck has 42 cards:
7–K, then printed 3, 2, Ace (strengths 14, 15, 16), and black/red Jokers (17, 18).
Preserve five/seven-card targets, Huzur/Joker exceptions, pickup provenance,
clockwise progression, mass/pair logic, defense assignment and deck-empty escape.
Documentation has known historical divergences; do not silently replace current
behavior with standard Durak assumptions.

## Architecture and reading order

1. `docs/PROJECT_AUDIT.md` records the original baseline, **not current status**.
   Read `docs/PROJECT_PLAN.md` for implementation progress, then
   `docs/AVATAR_MILESTONE.md`, `docs/FRONTEND_REBUILD.md` and
   `docs/FRONTEND_POLISH.md`. Older acceptance counts are historical snapshots.
2. `packages/client/src/App.tsx` mounts `room/CardRoom.tsx`. React owns setup,
   lobby, HUD, dialogs, selection, confirmation and accessible fallback controls.
   The old `HomePage.tsx` / `GameBoard.tsx` composition is retained as migration
   reference; it is no longer the application entry path.
3. `packages/client/src/contexts/GameContext.tsx` owns Colyseus connections,
   mutable-schema patch notifications, room messages and reconnection.
4. `packages/client/src/game/tableSnapshot.ts` copies the public presentation
   state plus the local private hand into the renderer boundary.
5. `packages/client/src/components/three/ThreeTable.tsx` manages the scene host.
   `TableRenderer.ts` owns the table, textures, card placement, animation and
   picking; `SeatedView.ts` owns the bounded camera; `AvatarRig.ts` owns peers;
   `FirstPersonHands.ts` loads and poses the generic skinned hand models.
6. `packages/server/src/rooms/DurakRoom.ts` owns legal actions, progression,
   privacy, bots, presence, reconnect and results. Also inspect `rooms/roomSettings.ts`,
   `packages/server/src/auth/session.ts`, and the real network tests under
   `packages/server/tests`. `packages/shared/src/state` holds network schemas;
   `packages/shared/src/engine/DurakEngine.ts` holds custom rules.

## Latest work: traditional card art and Huzur readability

- `packages/client/src/game/cardArt.ts` maps all 42 custom card identities to
  local traditional card artwork. Check that internal strengths never appear as
  incorrect printed ranks. Both Jokers are included.
- Assets and source/license notes: `packages/client/public/cards/classic/README.md`
  and `LICENSE.txt`. Art is from Austin Gabriel's CC0 deck at the pinned source
  commit documented there. Hands have their own model attribution/license under
  `packages/client/public/models/hands`.
- Regular faces are 512 × 744 WebP. The Huzur uses 1024 × 1488 variants generated
  directly from the source SVGs, both in the scene and its persistent public HUD.
- In `TableRenderer.ts`, inspect `face`, `loadFaceArt`, and the `huzur:` placement.
  A card can upgrade its cached material when it becomes Huzur. Async loading
  guards against disposal and an older low-resolution request overwriting an
  upgrade. Replacement maps are disposed. Cosmetic loading failure keeps a
  readable fallback.
- Face materials now use a light satin clearcoat, mipmaps and up to 16×
  anisotropic filtering. Renderer device pixel ratio is capped at 2 (previously
  1.5); review the mobile GPU cost. High-resolution textures load on demand,
  rather than preloading all 42 into the GPU.
- The old Huzur tilt intersected the felt. Its current center is y=0.112,
  tilt=0.018 radians, above the felt top at y=0.075. Check depth, shadow, perceived
  contact, foreshortening and legibility from seated and spectator views.
- `room/CardRoom.tsx` and `room/card-room.css` provide a persistent public Huzur
  reference, including after deck exhaustion. Desktop reference size increased
  to 60 × 87 CSS pixels; mobile retains a compact layout. Verify actual Huzur
  swaps and spectators as well as a static starting screen.

## Highest-value review areas

1. Public/private state separation, incremental patches, identity checks and
   reconnect/rematch behavior; no opponent-hand or deck-order leaks.
2. Correct active-frontend integration with custom rules, especially defense,
   Huzur swaps, spectators, teams, Horse and escaped players.
3. Card readability, real-looking grip, clipping/occlusion, camera bounds,
   pointer selection versus camera drag, keyboard/touch and WebGL fallback.
4. Texture upgrade races, material sharing, resource disposal, repeated
   joins/leaves and GPU memory growth; reduced-motion and hidden-tab behavior.
5. Mobile cost of clearcoat, DPR 2, anisotropy, shadows and the additional Huzur
   texture; retain device-specific uncertainty rather than extrapolating desktop.
6. Stale docs, retained migration systems and incomplete product flows. The
   replacement frontend still needs shop/purchase/equip, profile/history and
   leaderboard migration, plus sound/mute work. Flag cleanup candidates with
   evidence; do not blindly delete them.

## Validation evidence and limits

The latest Huzur rendering pass ran successfully:

```text
npm run build -w @durak/client
npm run lint -w @durak/client
npm run test -w @durak/client -- src/test/cardArt.test.ts src/test/CardRoom.test.tsx
```

The build includes the client TypeScript check. The focused tests passed 17/17.
All 42 high-resolution filenames were checked against the regular face set.
Desktop Chromium loaded the Huzur image at its actual 1024 × 1488 dimensions;
390 × 844 viewport checks found its reference visible and no horizontal document
overflow. Screenshots are in `output/playwright/huzur-high-resolution-desktop.png`
and `output/playwright/huzur-high-resolution-mobile.png`.

These are focused latest-pass results, not a fresh full-monorepo test run.
Earlier full-suite/network/browser evidence appears in the milestone docs.
Review those claims against their dates and the current implementation.

Known build warnings remain: Vite config uses `__dirname`; the lazy Three.js
chunk exceeds the 500 kB warning threshold (about 665 kB raw / 170 kB gzip in the
latest build). Physical phones, an embedded Discord client, external OAuth,
MongoDB/Redis persistence and production deployment have not been established
by these browser checks. Dependency-review findings in `docs/security` should
be rechecked before release; historical audit counts are not current guarantees.

If a fresh broader verification is useful, report the scope and run the root
commands separately: `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build`. Root lint currently covers only workspaces with a lint script.
Server/shared builds perform no-emit type checking; only the client produces
bundled production assets. Do not report those as compiled server artifacts.

## Requested output

Provide prioritized findings with file/line evidence and reproduction steps,
then a short assessment of the current architecture and visual quality. End
with a concrete next implementation tranche and any unresolved rule questions.
If no confirmed defects are found, say so and list the remaining validation gaps.
