# Durak production readiness review

Reviewed 2026-10-26. Launch target supplied by the owner: approximately 100 concurrent human players.

## Remediation implemented on main

The owner authorized parallel implementation after the initial review. The changes below are implemented locally on `main`; existing unrelated local work was preserved. No hosted deployment or infrastructure provisioning was performed.

| Finding               | Implementation and final evidence                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1: clock sync        | Safely normalizes MessagePack uint64 epochs, validates numeric pongs, periodically resynchronizes, and ignores messages from stale connections. The real network test covers a five-minute client clock skew; production-image epoch ping also passed during drain.                                                                                                                                                                              |
| R2: shutdown          | One signal owner, direct Node PID 1, 30-second local-room drain, persistence flush, and 40/45-second process/host deadlines. Final container test kept an active player connected for 30,144 ms and stopped after 30,523 ms. Existing play and epoch ping worked during drain; readiness and new matchmaking returned 503.                                                                                                                       |
| R3: readiness/results | Dependency readiness, Mongo/index initialization before listening, persistent per-machine outbox, startup replay, bounded retries, immutable snapshots, permanent completion markers and temporary profile receipts. Actual Mongo outage returned health 200 / readiness 503 / new match 503, then recovered to 200. Actual interrupted reward writes, disk replay, and a subsequent restart all preserved one result and one reward per player. |
| R4: admission         | HTTP auth, registration, matchmaking, and create limits; process room/client/bot budgets; raw Colyseus ingress protection; trusted-proxy assumption documented. Metrics showed all claims returned to zero after load clients left.                                                                                                                                                                                                              |
| R5: dependencies      | Compatible Express/body-parser/qs updates removed the body-parser high entry. Production audit is now 14 entries, including 3 high. The remaining Colyseus/nanoid and Discord/Zod paths are documented in the dependency review and still require an explicit release risk decision.                                                                                                                                                             |
| R6: CI gate           | Formatting and unused-dependency checks pass. The full integrated check passed 459 tests with 4 optional benchmark tests skipped; 24 focused traffic/outbox tests passed after the final slash-alias and filesystem sync changes. Root build and final workspace type checks passed.                                                                                                                                                             |
| Presentation          | Safe seat labels plus readable roster; contrasting 44px controls; 60 Hz desktop / 30 Hz mobile cadence. Browser measurements were 240 / 120 rendered frames over four seconds and zero settled frames with reduced motion. Hard Solo finished after 16 browser actions; rematch/refresh, four renderer fallback cycles, narrow 320px layout, and console checks passed.                                                                          |

The hardened one-CPU/512 MiB image repeated the 100-player checks with per-client benchmark IPs to represent separate users behind the trusted ingress. Local ping p95 was **7.83 ms** across 25 four-player rooms and **8.09 ms** across 100 hard-bot rooms; 3,847 and 1,963 client moves were submitted over the respective 40-second phases. No game error messages were recorded. Admission and authentication limits were tested separately. These remain short local measurements, not staging service guarantees.

Final evidence is in `output/fixed-container-load-results.json`, `fix-drain-results.json`, `fix-outage-results.json`, `fix-recovery-results.log`, `fix-result-integration.log`, `fix-check.log`, `fix-build.log`, `fix-format.log`, `fix-knip.log`, and `output/playwright/polish-*.png`. They are local ignored artifacts. Runtime settings and rollout steps are in [OPERATIONS.md](OPERATIONS.md).

**Remaining release gates:** decide the three residual high dependency entries; verify the persistent Fly volume and room routing on the target deployment; perform the staging soak, physical-phone, authenticated audience, and external Discord checks. Live unfinished games still require a communicated restart policy; the outbox protects results, not live-room migration between processes.

## Original review

**Initial decision: hold the public launch until the release blockers below are resolved.** The local production container handled the 100-player workloads with useful headroom. The immediate concerns were shutdown behavior, database readiness, clock synchronization, traffic protection, dependency findings, and the failing formatting gate. The original evidence and findings below are retained as the baseline; the remediation status above supersedes their implementation status.

The initial review created local evidence and this report before the owner authorized fixes. The preceding mass-rule documentation changes remain separate.

## Evidence and limits

| Check                                          | Result                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                | Passed: 409 tests passed, 4 skipped; lint had 179 warnings and no errors; workspace type checks passed                   |
| Test breakdown                                 | Client 141, independent Grades workspace 15, server 187, shared 66                                                       |
| Skipped suites                                 | Optional bot training/benchmark suites; these are not failed gameplay assertions                                         |
| `npm run build`                                | Passed for all workspaces                                                                                                |
| `npm run knip`                                 | Passed with configuration hints                                                                                          |
| `npm run format:check`                         | Failed on four files; see R6                                                                                             |
| Clean `docker build -t durak-release-review .` | Passed                                                                                                                   |
| Production image runtime                       | Started with MongoDB 7; local container logs confirmed database connection                                               |
| Production container budget                    | One CPU, 512 MiB memory limit                                                                                            |
| Production dependency audit                    | 16 package entries: 0 critical, 4 high, 10 moderate, 2 low                                                               |
| Browser gameplay                               | Solo played through to a confirmed result using visible card controls                                                    |
| Rematch and refresh                            | Recovered an active game with a saved reconnection token and one canvas                                                  |
| WebGL failure                                  | Forced context loss switched to fallback; four 2D/3D cycles restored one canvas                                          |
| Visual review                                  | Current production build at 1440×900, 1024×768, and 390×844; six-seat spectator view included                            |
| Production shutdown                            | Failed drain acceptance: active client disconnected after 78 ms; container stopped after 346 ms                          |
| Database outage                                | Failed readiness acceptance: `/health` returned HTTP 200 and `status: ok` after the review MongoDB container was stopped |

The desktop browser runs on this workstation. A narrow browser viewport is not a physical-phone GPU, thermal, battery, network, or touch test. The local Docker CPU limit is not a measurement of Fly shared-CPU contention. Hosted Redis routing, external Discord OAuth/embedding, and real authenticated-user reward bursts were not exercised. There was no long-duration soak or live-host load test.

The first browser playthrough helper stopped at its old iteration budget; a continuation reached the result. Its result detection and the rematch helper still searched for the former “Rematch” button. Copies in `output/` were adapted to the current “Game result” / “Ready for next game” UI for this review. Update the committed browser helpers before treating them as repeatable release gates.

## Measured server capacity

The production image was run with `--cpus=1 --memory=512m`. MongoDB ran in a separate local container. Two consecutive 40-second workloads used real Colyseus network clients, filtered state, legal plays, pickups, repeated games, head movement at 5 messages per second per player, and one ping per second per player. The bot workload added 100 hard bots to 100 human clients. The load generator ran outside the application container.

| Workload                     | Human clients | Client join batch | Submitted moves | Ping samples | Ping p50 | Ping p95 | Ping p99 |
| ---------------------------- | ------------- | ----------------- | --------------- | ------------ | -------- | -------- | -------- |
| 25 four-player public tables | 100           | 571 ms            | 3,850           | 3,900        | 4.26 ms  | 9.52 ms  | 12.14 ms |
| 100 private hard-bot tables  | 100           | 524 ms            | 1,981           | 3,900        | 3.62 ms  | 6.61 ms  | 36.03 ms |

No game error messages were recorded and the container did not crash or get OOM killed. Across the observed container session, Docker reported a maximum 165.1 MiB memory usage and 79.37% CPU. Those maxima include the full observed session rather than isolated per-phase peaks. Docker memory accounting differs from process RSS.

An earlier instrumented host process recorded 252–273 MiB peak RSS and worst sampled event-loop p99 delays of about 25–30 ms. That host process was not CPU constrained and those figures must not be substituted for container measurements.

**Interpretation:** 100 players looks feasible on one process for these tested workloads. This does not establish a maximum capacity or prove launch readiness. The tests emphasize five-card games; seven-card mass-defense bursts, many spectators, slow clients, authenticated result writes, attack traffic, and a sustained peak need separate coverage. The four-player phase had at least one result observed by 96 of the 100 client views; 63 solo client views observed a result during their phase. Every game was not required to finish within 40 seconds.

The ping probe used a fractional `performance.now()` value after discovering R1. The shipping client's epoch timestamp ping is broken; the latency numbers measure the server through the corrected probe, not the shipping client's synchronization path.

Raw evidence is under `output/`: `release-container-load-results.json`, `release-container-load-sustained.log`, `release-container-stats.jsonl`, `release-load-results.json`, `release-drain-results.json`, `release-check.log`, `release-build.log`, `release-format.log`, `release-knip.log`, `release-docker-build.log`, and `release-audit-production.json`. These artifacts are ignored by Git. Load and browser probe scripts are also retained there.

## Release blockers

### R1 — Epoch ping timestamps are decoded as bigint and silently rejected

**Priority: P1.** Client: `packages/client/src/contexts/GameContext.tsx:327`. Server: `packages/server/src/rooms/DurakRoom.ts:242`.

The client sends `{ clientTime: Date.now() }`. The installed client MessagePack encoder emits an integer representation which the server's `msgpackr` decoder reads as a `bigint`. The server calls `Number.isFinite(message.clientTime)`, which rejects it, and returns without sending a pong. The client retains its default zero server-time offset.

Reproduced over the production container's WebSocket: `clientTime: 1` received a pong; `clientTime: Date.now()` did not. Also reproduced directly with the installed encoder and decoder: the small integer decoded as `number`, while the epoch timestamp decoded as `bigint`.

**Impact:** users with different local clocks can see incorrect turn/countdown times and mistimed server-stamped gestures. This also invalidates the shipping clock-sync path as a monitoring signal.

**Required:** define a wire representation for timestamps, normalize and validate it safely at the receiving boundary, and add a real encoded-message regression using an epoch value. Verify server offset handling with an intentionally skewed browser clock.

### R2 — Production shutdown bypasses the intended game drain

**Priority: P1.** `packages/server/index.ts:467` and `packages/server/index.ts:502`; `fly.toml:4`.

`new Server()` defaults to registering Colyseus's own graceful-shutdown signal handlers. The application separately registers SIGINT/SIGTERM handlers that intend to wait up to 30 seconds for rooms to drain. Both handlers run; the framework shutdown disposes rooms and exits before that wait completes.

A dedicated production-image reproduction created a Solo room, waited for `phase: playing` with five cards in the player's hand, then ran `docker stop --timeout 40`. The player received leave code 4000 after **78 ms**, and the container exited after **346 ms**. Logs show “Signal received, draining...” immediately followed by client departure and game-log persistence. There was no 30-second drain.

The configured `kill_timeout` also sits under `[deploy]`, while Fly documents the application-level option at the root. Correct that placement and validate it with Fly tooling before relying on its value. [Fly configuration reference](https://fly.io/docs/reference/configuration/#kill_timeout-option).

**Impact:** a deploy or machine shutdown terminates active games immediately. A saved game log does not restore a live room after restart.

**Required:** establish a single shutdown owner, stop accepting new matches before draining, and prove an existing room remains playable during the grace period. Define what happens at the deadline and communicate interrupted games. Test the actual image and deployment signal, including a running room.

### R3 — Database outage is invisible to health checks

**Priority: P1.** `packages/server/index.ts:67`, `packages/server/index.ts:458`, `packages/server/src/rooms/DurakRoom.ts:2103`, and `fly.toml`.

The server begins listening without awaiting successful MongoDB connection. A connection failure is logged, while `/health` continues to return success. Game persistence returns early when MongoDB is disconnected. `fly.toml` contains no HTTP service health-check configuration.

Reproduced by stopping only the dedicated review MongoDB container: `/health` still returned `{"status":"ok", ...}` after six seconds. The database was then restarted.

**Impact:** the host can route players to an instance where sign-in, profiles, or result persistence are unavailable. Players can finish games whose durable results are missing.

**Required:** separate process liveness from dependency readiness, make readiness fail when required persistence is unavailable or the process is draining, and wire it into deployment checks. Define how completed results are retained/retried or how rated play is paused during database outages.

### R4 — Public traffic has no global admission or HTTP auth limits

**Priority: P1 for an open public launch.** `packages/server/index.ts:108`, `packages/server/index.ts:175`, `packages/server/index.ts:221`, and `packages/server/src/rooms/DurakRoom.ts:1633`.

Room actions have a per-client sliding-window limit. Head movement has its own cadence limit, and individual rooms cap connections. These protections do not provide a global cap on room creation, total bot rooms, connection attempts, or HTTP authentication work. The Express auth endpoints have no visible request limiter. Creating a separate guest Solo room also provisions a bot.

**Impact:** traffic outside the tested workload can consume server CPU/memory or database capacity. A 100-player benchmark does not bound how much work an untrusted visitor can request.

**Required:** add HTTP authentication throttles and bounded room/connection admission, with explicit busy/retry responses and monitoring. Include bot-room capacity in the budget. Verify these protections through HTTP and matchmaking, rather than only testing room-message limits.

### R5 — Production dependency findings need reachable-path triage

**Priority: P1 pending triage.** `package-lock.json`; current registry output in `output/release-audit-production.json`.

`npm audit --omit=dev --json` reported four high-severity package entries: `body-parser`, `nanoid`, `zod`, and the Discord SDK through its dependencies. This is four affected package entries, not necessarily four independent exploitable application paths.

The body-parser entry includes a compressed-body denial-of-service advisory and has an available compatible fix. Nanoid's audit fix recommendation crosses a major Colyseus version. The SDK/Zod path needs explicit upstream/usage review. [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

**Required:** apply compatible fixes, inspect the actual reachable versions and invocation paths, and document accepted residual exposure. Avoid treating `npm audit fix --force` as a reviewed framework migration. The Dockerfile installs development dependencies too, so the production-only audit does not describe every package present in the image.

### R6 — The current CI formatting gate fails

**Priority: release gate.** `.github/workflows/ci.yml:31`.

`npm run format:check` reports four files:

- `.taste-skill/direction.json`
- `docs/security/dependencies-after.json`
- `docs/security/dependencies-before.json`
- `docs/security/DEPENDENCY_REVIEW.md`

These include existing local/untracked work present before the review. Decide which files belong in the release and format the committed set. CI runs formatting before deployment, so a successful local test/build alone is insufficient.

## Presentation and animation findings

### P1 — Six-seat names and counts are clipped or obscured

**Priority: P2; resolve before promoting six-seat mobile play.** `packages/client/src/components/three/TableRenderer.ts`, seat/camera layout and labels; `packages/client/src/room/card-room.css`.

At 390×844, the six-seat spectator view clips labels on the outer left and right seats. At 1024×768, the result panel covers the right-hand seat label, while scene labels and the bottom HUD compete for space. There was no document-wide horizontal overflow; this is clipping inside the table presentation.

Evidence: `output/playwright/release-six-seats-mobile.png`, `release-six-seats-tablet.png`, and `release-six-seats-desktop.png`. Clamp/project seat labels into a safe screen region or provide a persistent readable seat list, and reserve space around result/action panels. Check seated-player views as well as spectator views.

### P2 — Table controls need more contrast

**Priority: P2.** `packages/client/src/room/card-room.css` and the table toolbar in `CardRoom.tsx`.

“Gestures”, “Recenter”, “2D view”, and “Card controls” are small muted text laid over a changing table/wood background. Their contrast varies as the camera or scene changes. Provide a stable contrasting surface and clearly visible keyboard focus/touch targets. This is a visual finding; a formal accessibility contrast audit was not performed.

### P3 — Rendering is responsive locally, but desktop idle cost remains continuous

**Priority: P2 for device acceptance.** `packages/client/src/components/three/TableRenderer.ts:1202`, `:1219`, and `:1354`.

The renderer pauses when the document is hidden, lowers pixel ratio and removes shadows for the mobile path, caps mobile updates near 30 Hz, and respects reduced motion. Resource cleanup and WebGL fallback passed the browser checks. These are useful foundations for release.

In a four-second six-seat browser probe, the mobile-width path rendered 132 frames (about 33/s) and averaged 54 indexed draw calls per rendered frame. Desktop rendered 421 frames (about 105/s on this workstation/browser) and averaged 109 indexed draw calls per rendered frame. These are actual intercepted `drawElements` calls, not a full GPU timing measurement; other draw methods are excluded.

The desktop loop schedules another frame whenever avatars exist and reduced motion is off. It follows the display/browser cadence continuously, including between turns. On a high-refresh display this can spend substantially more GPU/CPU than a fixed 60 Hz budget. Validate on actual phones and integrated GPUs, and consider a desktop cap or adaptive quality policy before promising battery/performance quality.

### P4 — First-load, sound, and acceptance coverage remain incomplete

**Priority: P2.** Production build main JS is about 486 kB / 146 kB gzip; the large character/graphics chunk is about 666 kB / 173 kB gzip. The character chunk triggers a build-size warning. Static assets have no application-level compression middleware in the reviewed server; verify actual edge transfer behavior before claiming gzip sizes as delivery sizes.

The hand interaction, explicit confirmation, defense previews, result sequence, and fallback are functional in the reviewed browser. Sound/music/mute polish was not accepted in this pass. Real phone touch, slow-network loading, assistive-technology use, all team/Horse result states, and external Discord embedding remain required launch checks. Update stale browser helper selectors so these checks can be repeated reliably.

## Deployment and capacity recommendation

For the first approximately 100-player release, start with a single deliberately sized and monitored process, kept warm. The current 512 MiB local container passed the short workload, so an immediate multi-machine migration is not justified by this evidence alone. Choose extra memory/CPU headroom after a longer run; do not equate a short pass with a guaranteed shared-CPU service level.

Set explicit Fly connection-based soft/hard limits based on observed sustained capacity, and expose room counts, active clients, event-loop delay, process memory, bot decision time, database latency, and result-write failures. `min_machines_running = 0` currently allows the application to go cold. [Fly concurrency configuration](https://fly.io/docs/reference/configuration/#http_service-concurrency).

RedisPresence and RedisDriver are wired in when `REDIS_URL` is supplied, but this does not prove multi-machine room routing. The source contains no explicit Fly replay routing or per-process public address setup; the `sticky_sessions = true` line is not sufficient evidence that separate requests for a room will reach its owner. Before adding instances, verify real create/join/reconnect traffic across two machines and configure the required routing. [Colyseus scaling reference](https://docs.colyseus.io/deployment/scalability/).

Before launch, run a 30–60 minute workload on the intended staging machine with all 100 players active through repeated games, authenticated result writes, representative seven-card masses, and a spectator burst. Exercise a database interruption and a rolling deploy during live games. Record latency, memory trend, disconnect/error rates, and recovery behavior. A controlled audience rollout with a clear concurrency cap is preferable to an unrestricted first opening.

## Suggested order

1. Fix timestamp synchronization and the competing shutdown handlers; add focused network/container regressions.
2. Implement dependency readiness and persistence failure behavior; wire deployment health checks.
3. Add HTTP/matchmaking admission protection and operational metrics.
4. Triage dependency findings and restore a clean CI gate.
5. Fix six-seat label visibility and table-control contrast; update browser acceptance helpers.
6. Run the staging soak, physical-phone checks, authenticated persistence, and Discord acceptance; then approve the public rollout.
