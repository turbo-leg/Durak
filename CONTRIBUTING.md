# Contributing to Durak

Thank you for your interest in contributing to Durak! This document outlines the process for setting up the project locally and contributing code.

## 🚀 Getting Started

This project is a monorepo built with npm workspaces.

### Prerequisites

- Node.js (v20+ recommended)
- npm (v10+)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/turbo-leg/Durak.git
   cd Durak
   ```

2. Install dependencies (this will install for all workspaces):
   ```bash
   npm install
   ```

### Running Locally

You can run both the client and server concurrently using the root script:

```bash
npm run dev
```

- **Client** runs on `http://localhost:5173`
- **Server** runs on `http://localhost:2567`

## 🛠️ Project Structure

- `packages/shared`: Game logic, state schemas, and AI bots.
- `packages/server`: Colyseus multiplayer server.
- `packages/client`: React frontend.

## ✅ Pull Request Process

1. Create a feature branch (`feat/your-feature` or `fix/your-fix`).
2. Ensure your code passes the linter and tests:
   ```bash
   npm run lint
   npm run test
   ```
3. Commit your changes. (Note: A pre-commit hook will automatically run Prettier and ESLint on your staged files).
4. Push your branch and open a Pull Request against `main`.
5. Fill out the PR template completely.
6. A maintainer will review your PR. Once approved and CI passes, it will be merged.

## 📝 Code Style

We use **Prettier** for code formatting and **ESLint** for static analysis.
You don't need to worry about formatting manually—just commit your code and the `lint-staged` hook will format it automatically.
