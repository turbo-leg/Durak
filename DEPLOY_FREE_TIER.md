# Free-Tier Deployment + Discord Release (Fly.io)

This project is configured to run as a **single Fly.io app**:

- `@durak/server` hosts Colyseus + Express
- built frontend from `packages/client/dist` is served by the server on the same origin

This is ideal for Discord Activities because API + WebSocket + frontend all share one HTTPS domain.

## 1) Prerequisites

Install Fly CLI and authenticate:

```bash
brew install flyctl
fly auth login
```

## 2) One-time app setup

The repo includes:

- `Dockerfile` (builds client, starts server)
- `fly.toml` (ports/VM/http service config)

Pick your app name and update `app` in `fly.toml` if needed.

## 3) Deploy

From repo root:

```bash
fly launch --no-deploy
fly deploy
```

If you already launched once, just redeploy:

```bash
fly deploy
```

After deploy, note your hostname, for example:

`https://durak-discord-activity.fly.dev`

## 4) Discord Developer Portal setup

In your Discord app settings:

### URL Mappings

- **Prefix:** `/`
- **Target:** `durak-discord-activity.fly.dev`

(No `https://` in the target field.)

### Activity URL

Use full URL:

`https://durak-discord-activity.fly.dev`

### OAuth2 scopes for invite

- `bot`
- `applications.commands`

## 5) Validate release

1. Ensure app is installed in your test server.
2. Enable Application Test Mode in Discord desktop for this app.
3. Launch from voice channel Activity menu.
4. Confirm room create/join works for 2+ users.

## Ops notes (free tier)

- Free/shared compute may cold start.
- If machine sleeps, first launch can take longer.
- WebSocket game rooms reset on restart/redeploy.

## Useful Fly commands

```bash
fly status
fly logs
fly ips list
```

## Local fallback

```bash
npm run dev:server
npm run dev:client
```

Use `https://localhost:5173` in Discord Application Test Mode for local testing.
