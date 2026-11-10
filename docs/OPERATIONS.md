# Operating the first public release

The initial deployment targets approximately 100 concurrent human players on one game-server process. Keep one Fly machine warm. The configured local budgets are 120 rooms, 150 human/spectator connections, and 120 permanent or stand-in bots. These are admission limits, not a measured maximum. Reconnecting players retain their seat claims.

## Startup and persistence

Production requires `JWT_SECRET`, `MONGO_URI`, and a persistent result-outbox directory. The server restores pending result work, then starts listening. MongoDB connects in the background and keeps retrying with backoff (2 s up to 60 s) when it is unreachable. Until it connects the server runs **degraded**: guest games work, match results wait in the outbox and the retry queue, and the account API (`/api/*` except the token routes) returns 503. Startup still fails when `MONGO_URI` is missing in production, or the saved results cannot be read. `DATABASE_DEGRADED_MODE=off` restores the old fail-closed behaviour.

Fly mounts the `durak_results` volume at `/data`, with `RESULT_OUTBOX_DIR=/data/results`. Docker Compose mounts a named `result-outbox` volume at the same location. The volume stores pending match snapshots while MongoDB is unavailable; keep it attached through container replacement and deploys. Do not place it under public/static assets, delete it during rollout, or share it between running server processes.

The Fly configuration describes a 1 GB initial volume. It does not provision anything until a deployment runs. Review the target app, volume attachment, and backup policy before deployment. A local container smoke test must also mount a directory or volume and set `RESULT_OUTBOX_DIR` explicitly when using production mode.

Redis presence/driver support does not establish multi-machine room routing. Keep the first release on one machine; a second machine needs verified owner routing and independent persistent outboxes. Live room state is in memory: the result outbox protects completed results, not an interrupted game's ability to resume after process restart.

## Health and metrics

| Endpoint       | Meaning                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`  | Process liveness. A running process can answer even during a database outage.                                                                                                                                                                                                         |
| `GET /ready`   | Returns 200 while the process can host games: not draining, and fewer than 500 results waiting. The body says `degraded: true` and `databaseReady: false` while MongoDB is down. Fly checks this endpoint; the CI smoke test and the uptime alert also require `databaseReady: true`. |
| `GET /metrics` | Disabled with 404 unless `METRICS_TOKEN` is configured. Requires `Authorization: Bearer <token>` when enabled; wrong/missing tokens return 401.                                                                                                                                       |

Operational metrics are also logged every 30 seconds as structured `Server operational metrics` records. They include room/client/bot counts and limits, pending/retrying result counts, RSS/heap bytes, and event-loop p95/p99/max milliseconds. Each event-loop log interval resets the histogram. The endpoint samples the current interval without resetting it. These snapshots contain no player identities, hands, or replay logs.

Watch readiness failures, increasing result backlog, memory trends, event-loop delay, and admission errors during the rollout. Short local tests support the 100-player target; they do not replace a sustained run on the intended hosting plan.

## Traffic limits

The ingress limiter protects authentication and the Colyseus matchmaking listener. Health checks, ordinary reads, static assets, and existing room WebSockets do not spend these HTTP budgets. Limits are per process and per trusted client IP:

- Authentication/token requests: 120 per minute.
- Registration: 20 per 15 minutes, in addition to the authentication budget.
- Matchmaking: 240 per minute.
- Room creation / join-or-create: 30 per minute, in addition to the matchmaking budget.

Denied requests return 429 with `Retry-After`. Exhausted bounded limiter bookkeeping or room/client/bot capacity returns 503. The server trusts one proxy hop; deployment routing must preserve that assumption. A shared NAT can cause otherwise separate players to share an IP budget, so account for that when testing event/campus audiences. A load generator using one IP will intentionally hit the room-creation limit before it can create 100 Solo rooms rapidly.

## Shutdown and deployment

SIGTERM/SIGINT starts one application-owned drain. New matchmaking receives 503 immediately, while existing WebSockets and reconnection reservations remain usable. Active games on this process get up to 30 seconds to finish. At the deadline, remaining rooms close and pending result persistence gets a bounded flush before MongoDB disconnects. The process has a 40-second hard stop fallback; Fly and Compose allow 45 seconds.

A deployment can therefore interrupt games that outlast the grace period. Use a quiet window for the first release and communicate restarts. Readiness becomes false while draining; verify the hosted proxy's reconnect behavior during a real staging rollout as well as the local direct connection path.

Before the audience launch, run the game/CI checks, a clean production-image startup, a 30–60 minute 100-player staging workload, an authenticated-result recovery test, a live-game rolling-deploy check, and physical-phone/Discord acceptance. Preserve the outbox volume during all restart checks.

## Deploys, smoke test and rollback

Every push to `main` deploys through the CI `deploy` job:

1. It records the last `complete` release image.
2. `flyctl deploy` runs `release_command` (`packages/server/scripts/check-db.mjs`) in a throwaway machine first. If MongoDB is unreachable the deploy stops before the live machine changes.
3. `scripts/smoke.mjs` checks that `/ready` reports `databaseReady: true`, then plays a solo game against a bot on the live site.
4. If the deploy or the smoke test fails, the job redeploys the recorded image and the run goes red.

Run the smoke test by hand: `node scripts/smoke.mjs https://durak-discord-activity.fly.dev` (add `--allow-degraded` to accept a missing database).

Manual rollback:

```sh
fly releases -a durak-discord-activity --image   # pick the last "complete" image
fly deploy -a durak-discord-activity --image <image> --strategy immediate --env SKIP_DB_CHECK=1
```

## Outages

The `Uptime` workflow checks `/ready` every 10 minutes and opens one "Production down" issue (closed automatically on recovery). Then:

- **`fly logs -a durak-discord-activity`** shows the cause. `MongoDB connection error; running degraded` means the database is unreachable: check the Atlas console (cluster paused or deleted, network access list, user password). Games keep working meanwhile.
- **New database:** `fly secrets set MONGO_URI='mongodb+srv://…' -a durak-discord-activity`. This restarts the machine, and the queued results are written once it connects.
- **Machine stopped after too many restarts:** fix the cause, then `fly machine start <id>` or deploy again.

## Changing region

The volume is tied to one region. To move (for example to Tokyo, `nrt`):

1. Make sure `/data/results` on the old volume is empty (`fly ssh console -C "ls /data/results"`), or copy the files out.
2. `fly volumes create durak_results -r nrt -s 1 -a durak-discord-activity`
3. Set `primary_region = "nrt"` in `fly.toml` and deploy.
4. Destroy the old machine and volume: `fly machine destroy <id>`, `fly volumes destroy <id>`.

Keep MongoDB in or near the same region; Atlas M0 is available in AWS Tokyo (ap-northeast-1).
