# Project Architecture & Roadmap

## 🏗️ Architecture Overview

The project is structured as an npm monorepo (workspaces) to ensure perfect type safety and synchronization between the client and the server.

### 1. `packages/shared/` (The Core)

- **Engine (`DurakEngine.ts`)**: Contains all stateless, authoritative game rules (deck generation, validation, attack/defense logic, backtracking, hierarchy).
- **State Schema (`state/`)**: Colyseus schema definitions (`GameState`, `Player`, `Card`). This ensures the UI precisely represents the server's single source of truth.
- **AI Engine (`ai/`)**: Contains advanced logic (MCTS, InferenceEngine, GrandmasterBot) for CPU opponents.

### 2. `packages/server/` (The Authoritative Backend)

- **Framework**: Node.js + Express + Colyseus framework.
- **Role**: Manages WebSocket lifecycle, Matchmaking, and holds the active rooms (`DurakRoom`). It listens for client actions (`Defend`, `Attack`, `SwapHuzur`), validates them against the `DurakEngine`, mutates the `GameState`, and syncs it back to clients automatically.
- **Scaling (Future)**: Uses Redis (`@colyseus/redis-driver`, `@colyseus/redis-presence`) for Pub/Sub messaging and matchmaking across multiple Node instances.

### 3. `packages/client/` (The Frontend)

- **Framework**: React + Vite (TypeScript).
- **Role**: Uses Colyseus.js (`colyseus.js`) to connect to the backend. Listens to state permutations and renders the UI (Table, Hands, Deck, Players). Handles user input (clicking cards, dragging).

---

## 🗺️ Development Roadmap / Issues Backlog

Feel free to suggest new ideas. We will add them to this list to track our progress!

### 🟦 Phase 1: Core Room & Game Flow (Server)

- [ ] **Issue**: Implement Full Game Loop Orchestration (Dealing initial hands, passing turns logic, handling successful defenses vs picking up cards).
- [ ] **Issue**: Implement Game Over conditions and win/loss emissions.
- [ ] **Issue**: Handle player disconnections/reconnections (Colyseus `allowReconnection()`).

### 🟨 Phase 2: Client Foundations (Frontend)

- [ ] **Issue**: Set up Colyseus Client connection context in React (connection state, loading screens).
- [ ] **Issue**: Implement basic Playmat UI (Render own hand, face-down opponent cards, deck size, face-up Huzur card).
- [ ] **Issue**: Implement Actions UI (Click/Drag cards to attack/defend, "Take Cards" button, "Pass" button).
- [ ] **Issue**: Basic error/notification toast system for invalid moves (linked to server error emissions).
- [ ] **Issue**: Add a "Players in Room" counter in the header/lobby UI.

### 🟧 Phase 3: AI & Bot Integration

- [ ] **Issue**: Integrate `GrandmasterBot` & `MCTS` logic into the room to act as an opponent if there aren't enough players.
- [ ] **Issue**: Add configuration for singleplayer vs multiplayer rooms.

### 🟩 Phase 4: Infrastructure & Scaling

- [ ] **Issue**: Connect Redis to Colyseus in `index.ts` to allow multiple horizontal Node containers.
- [ ] **Issue**: Setup Nginx or a Load Balancer in `docker-compose.yml` routing to `server` instances.

### 🟪 Phase 5: Polish & Ecosystem (Discord / Animations)

- [ ] **Issue**: Card animations (dealing, attacking, throwing to graveyard).
- [ ] **Issue**: Implement Discord Embedded App SDK (if this is meant for Discord Activity).
- [ ] **Issue**: Chat system or emote reactions.
