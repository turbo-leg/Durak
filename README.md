# Durak Discord Activity

This is a multiplayer Durak game built for Discord using Colyseus and React.

## Repository Structure

```text
.
├── packages/
│   ├── client/          # React + Vite frontend
│   ├── server/          # Colyseus + Express backend
│   └── shared/          # Shared game engine/state/types/tests
├── docs/
│   ├── architecture.md
│   ├── deployment/
│   ├── reference/
│   ├── notes/
│   └── github-guides/
└── tools/
    └── github-project/
        ├── scripts/
        └── data/
```

### Documentation

- `docs/architecture.md`
- `docs/deployment/free-tier-fly-io.md`
- `docs/reference/terminology.md`
- `docs/github-guides/README.md`

### GitHub Project Automation

- Scripts: `tools/github-project/scripts/`
- Data files: `tools/github-project/data/`

## Local Development

### Docker (Recommended)

To spin up the backend server and its necessary Redis database, use Docker Compose:

```bash
docker compose up --build -d
```

You can view the logs with:
```bash
docker compose logs -f server
```

The game server runs on `http://localhost:2567`.

### Client Development

You can run the React frontend independently via Vite for fast hot-reloading:

```bash
npm install
npm run dev:client
```
