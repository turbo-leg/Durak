# Durak implementation roadmap

Owner: Durak Project Manager. Updated 2026-10-20.
Baseline and file evidence: [PROJECT_AUDIT.md](archive/PROJECT_AUDIT.md).

## Technical direction

Keep Colyseus authoritative, shared custom rules intact and React responsible for connection, lobby, HUD and accessibility. Introduce Three.js as a presentation layer over the same observable game state and action interface. Do not create a second rules engine inside the renderer. Preserve the existing artwork and play path while migrating deliberately.

## Milestones and acceptance criteria

### 0. Audit and reproducible checks (first implementation tranche)

- [x] Map source, custom rules and active/prototype systems; capture unmodified baseline.
- [x] Write audit and this roadmap before implementation.
- [x] Add workspace typecheck/build validation for the source-based server/shared packages; retain the current ts-node deployment model until a separate artifact migration.
- [x] Repair unsafe seeded test accesses; make CI actually check client, server and shared and run the root build.
- [x] Close production debug mutation/deck injection paths without removing supported lobby bot creation; cover policy with registered-handler tests.
- [x] Correct four effect warnings and stale onboarding/status pointers; retain cleanup candidates pending evidence.
- [x] Repair the discovered Solo entry point: create/start a real easy/hard bot match, use five-card default, and stop advertising unimplemented medium difficulty.
- [x] Rerun tests, lint, typecheck and production build; record outcome below.

Exit: all explicit check commands succeed; no assertion-only typecheck workaround or silent skipping of missing build scripts; no game-rule change.

### 1. Multiplayer integrity (before public competitive release)

1. Verify JWTs on room joins for browser/Discord users; preserve guests and define unrated guest behavior. Test forged IDs and expired/invalid credentials.
2. Separate authoritative secrets from public view: private hands, deck order, draw logs and replay trace; add public counts and owner-only hand payloads. Update every UI consumer atomically.
3. Test real serialized snapshots **and incremental patches** for owner, opponent and spectator, including swaps, pickup, refresh/reconnect and rematch. No private card data may leak through logs/broadcasts.
4. Validate lobby options, supported modes/capacities, hand targets and malformed messages. Protect production monitor. Keep valid team/Horse behavior.
5. Characterize complete matches, turn expiration, bot legality, disconnect/rejoin, result persistence and rematch. Record rule discrepancies before resolving them.

Exit: no impersonation or private-card leak in network tests; valid modes finish without losing/duplicating any of the 42 cards. MongoDB/Redis/Discord integration remains explicitly separate from isolated test results.

### 2. Presentation boundary and Three.js vertical slice

1. Extract typed immutable render snapshots, card identities, seats and action callbacks from GameBoard; maintain Colyseus patch-driven updates despite mutable schemas.
2. Extract lobby/results/HUD and card-selection/defense-assignment interaction from the large board. Use shared validation for previews; server always decides legality.
3. Add Three.js dependencies after checking current official documentation. Lazy-load a real WebGL table scene: camera, lighting, felt surface, deck, Huzur, local hand, opponent backs and active attack/defense stacks.
4. Add pointer picking, card selection, attack and defense submission, pickup and Huzur swap using existing room messages. Keep keyboard/touch DOM controls and a fallback when WebGL is unavailable or loses context.
5. Dispose textures/geometries/materials/listeners on leave; resize correctly, cap pixel ratio and avoid hidden-tab rendering.

Exit: two browser clients play a complete custom-rules match through the 3D path, reconnect, rematch and leave without renderer leaks. Spectators never receive hidden cards. DOM fallback remains playable.

### 3. Visual and interaction polish

Establish a cohesive table/art direction using existing card backs and brand assets. Animate deal, selection, staging, reveal, pickup and discard with intentional timing; synchronize sound without obstructing input. Support reduced motion, mute, readable timers, clear illegal-move feedback, narrow screens and safe areas.

Exit: documented desktop/mobile acceptance runs, legible multi-card masses and all supported seat counts; agreed frame-rate and loading budgets measured on representative devices. Split scene/routes so home does not download 3D unnecessarily.

### 4. Cleanup and release

Consolidate the inactive lobby, setup paths, prototype AI and container definitions only after consumer/history checks and regression coverage. Replace stale docs with operational instructions. Exercise production-shaped container, persistence, monitoring, reconnect/load behavior and Discord embedding. Native packaging is retained and evaluated separately.

Exit: repeatable clean install and CI, documented environment/setup, reviewed deployment and known limitations; no P0/P1 release blockers. Deployment is a separate external action from local implementation.

## Progress reporting

Each tranche records concrete changes, commands/results, remaining blockers and next acceptance target here. Passing unit tests is not reported as browser or production validation. Audit baseline stays immutable.

### Tranche 0 results

Completed locally:

- Root `npm run typecheck` checks all three workspaces, including client project references and server tests. Server/shared `build` performs no-emit validation because deployment still uses source through ts-node; the client emits production assets.
- CI now uses Node 24 (matching the audited local major), checks server types and builds all workspaces. CI itself and containers were not executed locally.
- Production host debug impersonation/force-pass/dummies are blocked. Real easy/hard bots remain available in waiting lobbies. Client deck injection is restricted to test environments.
- Solo room options now provision a registered bot and start the match after the human joins. Unsupported configurations are rejected; the client requests five cards and offers the two implemented difficulties. Artwork is retained.
- Timer/result/staging effects use explicit primitive dependencies. Profile panel refetches when either email or Discord identity changes. Historical docs point to the verified audit/plan.

Validation after implementation:

| Command             | Result                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`          | PASS: 240 tests across 29 files (88 client, 86 server, 66 shared). Includes 20 production/solo guard cases and 2 real Colyseus solo join/start cases added in this tranche. |
| `npm run typecheck` | PASS across all workspaces; final root build also rechecked all updated types.                                                                                              |
| `npm run lint`      | PASS, zero warnings/errors (client scope).                                                                                                                                  |
| `npm run build`     | PASS. Client bundle warning remains: largest JS chunk 694.45 kB / 202.38 kB gzip.                                                                                           |
| `git diff --check`  | PASS; Git emits only Windows line-ending conversion notices.                                                                                                                |

No files deleted, shared engine rules changed, dependencies upgraded or deployment performed. Full bot matches and browser interactions have not yet been validated; solo network tests establish provisioning/deal/start, not full-match quality.

### Tranche 1: multiplayer integrity and playable 3D

Implemented locally:

- Owner-filtered hands, pickup provenance and draw logs; server-only deck order/replay; public hand/deck counts. Real Colyseus tests inspect snapshots and incremental patches for two players and a spectator, including pickup, refill and Huzur exchange.
- JWT-verified browser/Discord room identity, duplicate-account rejection, unrated guest matches and production monitor protection. Lobby settings and malformed messages are validated.
- A lazy-loaded Three.js table with custom card faces, equipped backs, public opponent counts, pointer selection and existing authoritative attack/defense controls. Keyboard controls, reduced motion, resizing, renderer disposal and explicit/context-loss 2D fallback remain available. The large React board still needs further extraction.
- Fixed bot pickup cycles, escaped-player turn progression, idle lead turns, case-sensitive invitation input, duplicate keyboard selection and actionable cards during exit animations. Shared engine rules were retained.
- Compatible dependency updates reduced npm audit from 53 findings (4 critical) to 23 (0 critical, 4 high, 16 moderate, 3 low). See [dependency review](security/DEPENDENCY_REVIEW.md); audit still exits nonzero.
- Added a cross-platform root development launcher. Windows `npm run dev` smoke verification started both Vite on port 5173 and Colyseus on port 2567. Server startup explicitly reports missing MongoDB configuration; persistence was not tested.

Validation:

| Check                  | Result                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`             | PASS: 297 tests / 33 files: client 93, server 138, shared 66. Includes seeded complete matches with card conservation across supported configurations, privacy/identity network tests and production guards. |
| `npm run lint`         | PASS, no errors or warnings; lint scope remains client.                                                                                                                                                      |
| `npm run typecheck`    | PASS, all workspaces.                                                                                                                                                                                        |
| `npm run build`        | PASS. Main client chunk 698.65 kB / 204.98 kB gzip; lazy 3D chunk 553.01 kB / 138.93 kB gzip. Bundle warnings remain. Server/shared builds validate source without emitting an artifact.                     |
| Real browser play      | A hard-bot Solo match finished; two isolated browser clients also finished the same private 3D match, with 21 driver actions per client and no browser errors.                                               |
| Presentation lifecycle | Desktop and 390×844 viewport checks, keyboard controls, forced WebGL context loss and four view-switch cycles passed. One active canvas remained after restoration.                                          |

Vite configuration migration and Mongoose deprecation notices remain visible. No claims are made about hosted CI, physical-device performance, persistence or external OAuth from these local results.

### Next acceptance targets

1. Rematch/refresh browser verification now passes: a further Solo match finished after 19 driver actions, then rematch → refresh restored the active game with one canvas. The reconnect token is saved again when a seated player enters active play; the repeatable script returns only its presence. Keep this acceptance check through later connection changes.
2. Complete interaction/visual polish for multi-card masses and all seat counts; extract lobby/results/HUD from GameBoard and measure loading/frame budgets on real mobile devices.
3. Resolve the remaining high dependency advisories through deliberate watcher/protocol upgrades, retaining network regression coverage.
4. Exercise production-shaped containers, MongoDB result writes, Redis scale-out and external Discord OAuth/embedding. Validate native builds separately.
5. Review documented cleanup candidates by consumer/history evidence before removing code or artwork. No speculative deletion has been performed.

Milestone 1 has substantial local coverage; milestone 2 has a working playable slice. Neither is a declaration that the polished-game/public-release criteria are complete.

### Tranche 2: replacement interactive frontend

At the user's request, replaced the active frontend composition rather than extending the former casino UI. Direction and acceptance notes: [FRONTEND_REBUILD.md](archive/FRONTEND_REBUILD.md).

- `src/App.tsx` now mounts `room/CardRoom.tsx`, with new home/setup/lobby, account/rules/leave dialogs, public discovery, spectator entry, hand controls, action dock and results/rematch. Existing auth, Colyseus providers and shared rules remain. The old HomePage/GameBoard/ShopPage/ProfilePage tree is not imported by the application. Source is retained as migration reference, not silently deleted with custom assets.
- The opening screen has an interactive practice hand on the same 3D table used for live play. Added wool/wood procedural textures, pearl rounded cards, a blue/copper palette, hover lift and bounded camera orbit. Rendering still settles when idle and releases resources when unmounted. Mobile defaults to native card buttons; desktop can expose them explicitly.
- Selection is tied to a room/phase/turn so mutable schema patches cannot carry old selections into a new turn. Defense previews use shared assignment logic; the server decides every move. Huzur controls preserve the Joker/Ace-of-Spades and pickup-provenance exceptions.
- All 305 tests pass across 34 files (101 client, 138 server, 66 shared). Eight new client cases exercise the replacement flow, not only the retired board: Solo/options, Horse setup, explicit attack confirmation, invalid defense, stale selection, Joker Huzur, pickup provenance and spectator controls. Root typecheck, lint and production build pass; after final UI refinements, client tests/lint and the root build were repeated.
- Production main JavaScript decreased from 698.65 kB / 204.98 kB gzip to approximately 456 kB / 137 kB gzip. The lazy 3D chunk is approximately 578 kB / 145 kB gzip, including orbit controls. Physical-device performance and loading budgets remain unmeasured.
- A further 390×844 browser-viewport Solo match also finished after 28 actions with mobile card controls. The final build measured 456.41 kB / 136.87 kB gzip for main JavaScript and 578.24 kB / 144.81 kB gzip for the lazy scene.
- Browser acceptance: a Solo match finished after 28 driver actions; rematch → refresh recovered with one canvas; forced context loss and four view switches passed. Actual raycast picking selected a card, and dragging changed the rendered camera view. Two isolated browser clients created/joined/readied/started a private match and finished after 20 and 21 local driver actions, with zero browser errors. Desktop 1440×900 and mobile 390×844 layouts were visually reviewed.

Remaining frontend work: migrate the old shop, purchase/equip, profile/statistics/history and leaderboard features into the new design; add a new sound/mute treatment; improve multi-card defense presentation, team/Horse results and all seat-count layouts; run physical touch/GPU/accessibility acceptance. Browser/embedded identity exchange remains wired, but external OAuth was not exercised in this tranche. Existing dependency and production-integration blockers remain. No server or shared-rule changes were needed for this frontend rebuild.

## Avatar direction update — 2026-10-21

The first playable social-table milestone is implemented and validated in [AVATAR_MILESTONE.md](archive/AVATAR_MILESTONE.md): seated first person, four character presets, hands/sleeves, synchronized head movement, supported format shortcuts and mobile layouts. Physical-phone and embedded Discord validation remain release checks. Voice, spatial audio and the full cosmetic editor are later milestones.

## Independent review fixes — 2026-10-21

The user supplied Claude's review. [CLAUDE_REVIEW_RESPONSE.md](archive/CLAUDE_REVIEW_RESPONSE.md)
maps its 16 findings to corrections and remaining validation gaps. The pass fixes
Horse transitions/full-match rematches, team results, expired-session recovery,
stable card identity/reparenting, asset fallback and partial-constructor cleanup.
It also adds mobile quality settings, slower settled avatar updates, and vertical
touch input support. No custom rule decisions were changed. All 346 tests pass;
root typecheck, lint and build checks and two-client browser acceptance pass.
Physical-phone validation and three explicit rule/product questions remain open.

## Casual character prototype — 2026-10-22

Implemented the user-approved Quaternius Casual trial, with a seated authored
model, matching first-person arms, public manual finger/nose/ear gestures,
head-following contact, a local mirror and server-controlled timing/cooldown.
The existing four presets remain available. See [CASUAL_AVATAR_PROTOTYPE.md](archive/CASUAL_AVATAR_PROTOTYPE.md)
for controls, asset provenance, tests, browser evidence and the remaining adoption
checks. Next: review the prototype's grip and character style, profile the
six-seat scene on physical phones, then expand the cast and customization.

## Soft-launch preparation: tooling and cleanup — 2026-10-23

- **Removed:** the old UI tree (GameBoard, Lobby, Home, Profile and Shop pages and their parts) and its tests, the unconnected shared AI prototype, template assets, a one-off PDF exporter and unused packages. Git history keeps them; the shop and profile screens are the reference for rebuilding those features.
- **One lint config** (`eslint.config.mjs`) now covers client, server, shared and scripts. The server's `any` types are warnings to burn down.
- **New tooling:** `npm run check`, `format:check`, `knip` (unused code), `character:build` and `character:shots`. CI runs formatting and knip too. Hooks: lint and format on commit, typecheck on push. LF line endings everywhere; VS Code recommendations.
- **In-game dev panel** (dev builds only, the backtick key): quick tables with bots, force a turn, copy state, renderer statistics.
- **One Dockerfile on Node 24**, used by Fly and by `docker compose` (now with MongoDB). A local build served the game and connected to MongoDB.
- **Docs:** historical records moved to `docs/archive/`. [CONTRIBUTING.md](../CONTRIBUTING.md) is the developer guide.
