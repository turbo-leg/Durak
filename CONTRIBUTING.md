# Developing Durak

An npm workspaces monorepo: `packages/shared` (rules engine and network schema),
`packages/server` (Colyseus game server and APIs) and `packages/client` (React, Vite and
the Three.js card room). Game rules: [GAME_RULES.md](GAME_RULES.md). Roadmap:
[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md). Characters: [docs/CHARACTER_SPEC.md](docs/CHARACTER_SPEC.md).

## Setup

Node 24 and npm 11, the same as CI and the Docker image.

```bash
git clone https://github.com/turbo-leg/Durak.git
cd Durak
cp .env.example .env      # fill in what you need; see README
npm install               # also installs the Git hooks
npm run dev               # server on :2567, client on :5173
```

In VS Code, accept the recommended extensions. Files then format with Prettier and fix
lint problems on save.

## Everyday commands

| Command                   | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `npm run dev`             | Server and client together, with reload                             |
| `npm run check`           | Lint, typecheck and every test: run before you push                 |
| `npm test`                | Tests in all three packages (`npm test -w @durak/client` for one)   |
| `npm run lint:fix`        | Fix what ESLint can fix                                             |
| `npm run format`          | Format everything with Prettier                                     |
| `npm run knip`            | Find unused files, exports and dependencies                         |
| `npm run build`           | Production client build plus server and shared type checks          |
| `npm run character:build` | Rebuild the character GLB after changing `spec.ts` or `generate.ts` |
| `npm run character:shots` | Screenshot every character clip (needs `npm run dev:client`)        |

## In the game: developer tools

In a dev build (`npm run dev`), press <kbd>`</kbd> anywhere in the game to open the dev
panel. It stays open across reloads until you close it.

- **Quick table:** a private six-seat table, then fill it with easy or hard bots, add a
  dummy (a seat with no AI) and start the game.
- **Steer a game:** force the turn on; copy the visible game state as JSON for a bug report.
- **Inspect:** room, phase, whose turn it is, deck count, and every seat (human or bot,
  cards held, connected).
- **Renderer:** frames per second, draw calls, geometries, textures and avatars on the table.
- **Character preview:** `/character.html` plays any clip on any character. Add
  `?clip=emote:cheer&view=face&preset=bot-buyna&at=650` to freeze a moment.

None of this ships: production builds drop the panel, and the server refuses its
debug-only actions in production.

## Git hooks and CI

- **pre-commit:** ESLint and Prettier fix the staged files.
- **pre-push:** typecheck, so type errors fail on your machine before CI.
- **CI** (`.github/workflows/ci.yml`): lint, format check, knip and typecheck; then tests;
  then the build. Pushing to `main` deploys to Fly.

Line endings are LF everywhere (`.gitattributes`, `.editorconfig`), including on Windows.

## Production image

There is one `Dockerfile`; Fly deploys it. To run it locally, with MongoDB and Redis:

```bash
docker compose up --build    # http://localhost:2567
```

## Pull requests

1. Branch from `main` (`feat/…` or `fix/…`).
2. `npm run check` passes.
3. Open a PR against `main`; CI must pass before it merges.

## Browser acceptance scripts

`scripts/browser/` holds Playwright snippets for full-game checks (create a room, play a
match through, rematch and reconnect, WebGL fallback). Run them with `playwright-cli
run-code --filename <script>` against a running dev server; each file says where to start.
