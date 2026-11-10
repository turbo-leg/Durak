# Durak for Discord

[![CI](https://github.com/turbo-leg/Durak/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/turbo-leg/Durak/actions/workflows/ci.yml)

**[Play it](https://durak-discord-activity.fly.dev)** (opens the standalone web build; the first load can take a few seconds while the server wakes up)

Durak (Дурак, "fool") is the card game where the last player holding cards loses. This version runs as a [Discord Activity](https://discord.com/developers/docs/activities/overview): anyone in a voice channel can start a table and play with 2 to 6 people, or against bots, without leaving the call.

## What I built

- **A server that owns the game.** Every move goes to a Colyseus room on the server, which checks it against the rules before changing the state. Clients only draw what the server tells them.
- **Hidden hands.** The game state uses per-client filters (`packages/shared/src/state/Player.ts`), so each player's browser receives only their own cards, not just a hidden copy of everyone's.
- **Shared game code.** The rules engine and the state schema live in `packages/shared`, so the server and the client agree on the shape of the game.
- **Bots.** Server-side bot players (`packages/server/src/ai`), with scripts that make bots play each other to compare strategies (`npm run bot:duel`, `npm run bot:selfplay`).
- **Deploys that don't drop games.** On SIGTERM the server stops accepting new connections and waits up to 30 seconds for running games to finish before it shuts down (Fly.io allows 45).
- **Checks on every pull request.** ESLint, Prettier, knip (unused code), TypeScript, about 390 Vitest tests including a server end-to-end test, and a production build. A push to `main` that passes deploys to Fly.io.

**Stack:** TypeScript, Colyseus, React, Three.js, Vite, MongoDB, Redis (optional, for running several server processes), Docker, Fly.io, Discord Embedded App SDK.

Built mostly by me ([@turbo-leg](https://github.com/turbo-leg)), with contributions from two friends.

## Quick start

```bash
git clone https://github.com/turbo-leg/Durak.git
cd Durak
cp .env.example .env                  # then fill in the required values
npm install
npm run dev                           # server :2567 + client :5173
```

Open `http://localhost:5173` for the standalone web build (Discord SDK is no-oped outside the embed).

For the production image with MongoDB and Redis, see [Running locally → Docker](#docker).

## Architecture

```
┌────────────┐   WebSocket   ┌──────────────┐   ┌──────────┐
│  Client    │ ◄───────────► │  Colyseus    │◄─►│ MongoDB  │  (profiles, stats, achievements)
│ React/Vite │   (Colyseus)  │  Server      │   └──────────┘
│            │               │  :2567       │   ┌──────────┐
└────────────┘               │              │◄─►│  Redis   │  (optional, multi-instance pubsub)
       ▲                     └──────────────┘   └──────────┘
       │ Discord Activity iframe
       ▼
┌────────────┐
│  Discord   │
│  (host)    │
└────────────┘
```

The client is served by the Colyseus server in production (single Fly app). In development the Vite dev server runs separately at `:5173` and proxies `/colyseus` and `/api` to the server at `:2567`.

Code layout: [CONTRIBUTING.md](CONTRIBUTING.md) and [the client README](packages/client/README.md). Game rules: [GAME_RULES.md](GAME_RULES.md). Move notation: [GAME_NOTATION.md](GAME_NOTATION.md).

## Environment variables

All variables and their defaults are documented in [`.env.example`](.env.example). Summary:

| Variable                 | Side   | Required                | Purpose                                                                                                                |
| ------------------------ | ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`              | server | prod                    | MongoDB connection string                                                                                              |
| `JWT_SECRET`             | server | prod                    | Signs email/password auth tokens (`openssl rand -hex 32`)                                                              |
| `REDIS_URL`              | server | optional                | Enables multi-instance horizontal scaling                                                                              |
| `PORT`                   | server | no (defaults to `2567`) | Colyseus listen port                                                                                                   |
| `DISCORD_CLIENT_ID`      | server | yes for OAuth           | Discord application ID                                                                                                 |
| `DISCORD_CLIENT_SECRET`  | server | yes for OAuth           | Discord OAuth secret (server-side token exchange)                                                                      |
| `VITE_DISCORD_CLIENT_ID` | client | yes inside Discord      | Same as `DISCORD_CLIENT_ID`, exposed to the client bundle. The app throws at startup if missing in the embedded build. |

Client variables live in `packages/client/.env.local`.

## Running locally

### Docker

Runs the production image with MongoDB and Redis: the closest local match to the deployed game. `.env` is optional here; without one, the server uses the compose database.

```bash
docker compose up --build -d
docker compose logs -f server
```

The game is served at `http://localhost:2567`.

### Without Docker

```bash
npm install
npm run dev                           # starts server + client in parallel
```

Individual processes:

```bash
npm run dev:server                    # @durak/server only
npm run dev:client                    # @durak/client only
```

## Discord OAuth setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **OAuth2**, copy the **Client ID** → `DISCORD_CLIENT_ID` (server) and `VITE_DISCORD_CLIENT_ID` (client). Copy the **Client Secret** → `DISCORD_CLIENT_SECRET`.
3. Under **Activities → URL Mappings**, point the root mapping at your dev/prod URL (e.g. `https://durak-discord-activity.fly.dev`).
4. Required OAuth scopes (see `packages/client/src/discordAuth.ts`): `identify`, `guilds`.
5. To test the embed, launch the activity from a Discord voice channel using the **Activities** picker (your app must be added to a test guild).

When the app is opened outside Discord (plain browser), the Discord SDK is bypassed and a local sign-in flow takes over — useful for solo testing.

## Running tests

```bash
npm run check                         # lint, typecheck and every test
npm run build                         # client production assets + server/shared type validation
```

CI also checks formatting and unused code (knip), then builds, on every PR. Every command is listed in [CONTRIBUTING.md](CONTRIBUTING.md). See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deploying to Fly.io

The production app is configured as `durak-discord-activity` in region `iad`. The Dockerfile builds the client with Vite and runs the server TypeScript through ts-node; the server serves the built client. Server/shared `build` scripts validate types without emitting runtime JavaScript. CI validates all workspace types before building; deployed infrastructure has not been verified by the local audit.

```bash
flyctl deploy                         # uses fly.toml + Dockerfile
flyctl secrets list                   # view configured secrets
flyctl secrets set MONGO_URI=... DISCORD_CLIENT_SECRET=... JWT_SECRET=...
flyctl logs                           # tail logs
```

`fly.toml` keeps one machine warm, checks `/ready`, and allows 45 seconds for a 30-second game drain and result flush. A persistent volume at `/data` retains pending results through restarts. The first release targets one server process; adding machines requires verified room-owner routing. See [operations](docs/OPERATIONS.md) for capacity limits, metrics, persistence, and rollout checks. For free-tier setup notes see [DEPLOY_FREE_TIER.md](DEPLOY_FREE_TIER.md).

## Troubleshooting

- **`VITE_DISCORD_CLIENT_ID` is not defined** at startup — set it in `packages/client/.env.local` (the app intentionally throws to fail loudly in the Discord embed).
- **Connection refused on `:2567`** — make sure the server is running (`npm run dev:server` or `docker compose up`).
- **OAuth callback fails inside Discord** — confirm the URL mapping in the Developer Portal matches the URL Discord is loading, and that `DISCORD_CLIENT_SECRET` is set on the server.
- **MongoDB `MongoNotConnectedError`** — verify `MONGO_URI` is reachable from your machine / Fly app. Atlas users: allow the source IP in Atlas → Network Access.
- **Rooms desync across two server instances** — set `REDIS_URL` so Colyseus can share presence; without it, each instance keeps its own room registry.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow. In short: branch off `main`, keep PRs small, make sure `npm run check` passes, and open a PR referencing the issue (`Closes #N`).

## License

[MIT](LICENSE)

## Bayesian Networks assignment — Question 6

The student grade prediction application is in [`packages/grades`](packages/grades/README.md).
From the repository root, run `npm install` and `npm run dev:grades`, then open
http://127.0.0.1:5174. Run `npm run test:grades` for its tests and `npm run build:grades`
for its production build. This workspace runs independently of the Durak game.
