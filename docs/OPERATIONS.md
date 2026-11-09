# Operating the first public release

The initial deployment targets approximately 100 concurrent human players on one game-server process. Keep one Fly machine warm. The configured local budgets are 120 rooms, 150 human/spectator connections, and 120 permanent or stand-in bots. These are admission limits, not a measured maximum. Reconnecting players retain their seat claims.

## Startup and persistence

Production requires `JWT_SECRET`, `MONGO_URI`, and a persistent result-outbox directory. The server initializes MongoDB indexes and restores pending result work before accepting HTTP/WebSocket traffic. Startup fails if the required initialization cannot complete.

Fly mounts the `durak_results` volume at `/data`, with `RESULT_OUTBOX_DIR=/data/results`. Docker Compose mounts a named `result-outbox` volume at the same location. The volume stores pending match snapshots while MongoDB is unavailable; keep it attached through container replacement and deploys. Do not place it under public/static assets, delete it during rollout, or share it between running server processes.

The Fly configuration describes a 1 GB initial volume. It does not provision anything until a deployment runs. Review the target app, volume attachment, and backup policy before deployment. A local container smoke test must also mount a directory or volume and set `RESULT_OUTBOX_DIR` explicitly when using production mode.

Redis presence/driver support does not establish multi-machine room routing. Keep the first release on one machine; a second machine needs verified owner routing and independent persistent outboxes. Live room state is in memory: the result outbox protects completed results, not an interrupted game's ability to resume after process restart.

## Health and metrics

| Endpoint       | Meaning                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`  | Process liveness. A running process can answer even during a database outage.                                                                                            |
| `GET /ready`   | Returns 200 only when required persistence is ready, no failed result backlog remains, and the process is not draining. Otherwise returns 503. Fly checks this endpoint. |
| `GET /metrics` | Disabled with 404 unless `METRICS_TOKEN` is configured. Requires `Authorization: Bearer <token>` when enabled; wrong/missing tokens return 401.                          |

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
