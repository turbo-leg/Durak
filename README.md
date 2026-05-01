# Durak Discord Activity

This is a multiplayer Durak game built for Discord using Colyseus and React.

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
