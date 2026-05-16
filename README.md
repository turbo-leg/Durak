# Durak Discord Activity

A real-time multiplayer **Durak** (Дурак, "fool") card game built as a [Discord Activity](https://discord.com/developers/docs/activities/overview). Players can launch the game inside any Discord voice channel and play a 2–4 player match without leaving the call.

The stack: **Colyseus** (authoritative game server) + **React/Vite** (client) + **MongoDB** (profiles, stats, achievements) + **Redis** (optional, for multi-instance scaling).

---

## Quick start

```bash
git clone https://github.com/turbo-leg/Durak.git
cd Durak
cp .env.example .env                  # then fill in the required values
npm install
npm run dev                           # server :2567 + client :5173
```

Open `http://localhost:5173` for the standalone web build (Discord SDK is no-oped outside the embed).

For the full Docker-based setup (server + Redis), see [Running locally → Docker](#docker).

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

Deeper architecture notes: [ARCHITECTURE.md](ARCHITECTURE.md). Game rules: [GAME_RULES.md](GAME_RULES.md). Move notation: [GAME_NOTATION.md](GAME_NOTATION.md).

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

Spins up the Colyseus server + Redis. The fastest way to get a production-shaped backend running:

```bash
docker compose up --build -d
docker compose logs -f server
```

Server: `http://localhost:2567`.

Then run the Vite client locally for hot reload:

```bash
npm install
npm run dev:client                    # http://localhost:5173
```

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
npm test                              # all workspace test suites
npm run lint                          # eslint across all workspaces
npx tsc --noEmit -p packages/client/tsconfig.json   # typecheck client
npx tsc --noEmit -p packages/shared/tsconfig.json   # typecheck shared
```

CI runs lint + typecheck + tests + a production build on every PR. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deploying to Fly.io

The production app is `durak-discord-activity` in region `iad`. The Dockerfile builds both the client (Vite) and the server (tsc) and runs the server, which serves the built client.

```bash
flyctl deploy                         # uses fly.toml + Dockerfile
flyctl secrets list                   # view configured secrets
flyctl secrets set MONGO_URI=... DISCORD_CLIENT_SECRET=... JWT_SECRET=...
flyctl logs                           # tail logs
```

`fly.toml` configures auto-stop/auto-start machines, sticky sessions (required for Colyseus), and a 35s kill timeout to let in-flight rooms drain cleanly. For free-tier setup notes see [DEPLOY_FREE_TIER.md](DEPLOY_FREE_TIER.md).

## Troubleshooting

- **`VITE_DISCORD_CLIENT_ID` is not defined** at startup — set it in `packages/client/.env.local` (the app intentionally throws to fail loudly in the Discord embed).
- **Connection refused on `:2567`** — make sure the server is running (`npm run dev:server` or `docker compose up`).
- **OAuth callback fails inside Discord** — confirm the URL mapping in the Developer Portal matches the URL Discord is loading, and that `DISCORD_CLIENT_SECRET` is set on the server.
- **MongoDB `MongoNotConnectedError`** — verify `MONGO_URI` is reachable from your machine / Fly app. Atlas users: allow the source IP in Atlas → Network Access.
- **Rooms desync across two server instances** — set `REDIS_URL` so Colyseus can share presence; without it, each instance keeps its own room registry.
- **Tests hang on Node 20** — pointer events in `@testing-library/user-event` can be flaky on Node 20; use `fireEvent.click` for click interactions in new tests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow. TL;DR: fork → branch off `main` → keep PRs small → ensure `npm run lint && npm test` pass → open a PR referencing the issue (`Closes #N`).

## License

[MIT](LICENSE)
