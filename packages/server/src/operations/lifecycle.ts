import express, { type RequestHandler } from 'express';
import type http from 'http';

interface ReadinessDependencies {
  databaseRequired: boolean;
  databaseConnected: () => boolean;
  pendingResults?: () => number;
  /**
   * Keep hosting games while the database is down. Results wait in the durable outbox and
   * the retry queue, and are written once the connection returns. Accounts stay closed.
   */
  allowDegraded?: boolean;
  /** Stop new games once this many results are waiting, so the retry queue cannot fill. */
  maxPendingResults?: number;
}

/** Process-local readiness. Importing a room in isolation does not start dependencies. */
export class ServerLifecycle {
  private dependencies: ReadinessDependencies = {
    databaseRequired: false,
    databaseConnected: () => false,
  };
  private draining = false;

  configure(dependencies: ReadinessDependencies): void {
    this.dependencies = dependencies;
  }

  get isDraining(): boolean {
    return this.draining;
  }

  get databaseReady(): boolean {
    return !this.dependencies.databaseRequired || this.dependencies.databaseConnected();
  }

  get isReady(): boolean {
    return this.readiness().ready;
  }

  beginDrain(): void {
    this.draining = true;
  }

  readiness() {
    const databaseReady = this.databaseReady;
    const pendingResults = this.dependencies.pendingResults?.() ?? 0;
    const { allowDegraded = false, maxPendingResults = 0 } = this.dependencies;
    const ready = allowDegraded
      ? !this.draining && pendingResults < Math.max(1, maxPendingResults)
      : !this.draining && databaseReady && pendingResults === 0;
    const degraded = !databaseReady || pendingResults > 0;
    return { ready, degraded, draining: this.draining, databaseReady, pendingResults };
  }
}

export const serverLifecycle = new ServerLifecycle();

/** Colyseus attaches matchmaking directly to HTTP, outside the app router. */
export function protectServerRequests(server: http.Server, ...middleware: RequestHandler[]): void {
  const requestListeners = server.listeners('request');
  server.removeAllListeners('request');
  const ingress = express();
  ingress.set('trust proxy', 1);
  ingress.use((req, res, next) => {
    // Colyseus 0.15 checks for this substring anywhere in req.url. Reject aliases
    // before dispatch so a prefix/query cannot bypass canonical route budgets.
    if (req.url.includes('/matchmake') && !/^\/matchmake(?:\/|$)/.test(req.path)) {
      res.status(404).json({ error: 'Unknown matchmaking route' });
      return;
    }
    next();
  });
  for (const handler of middleware) ingress.use(handler);
  ingress.use((req, res) => {
    for (const listener of requestListeners) listener.call(server, req, res);
  });
  server.on('request', ingress);
}

/** Existing WebSockets and reconnection reservations remain usable while draining. */
export function createReadinessGate(lifecycle: ServerLifecycle): RequestHandler {
  return (req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const matchmaking = path.startsWith('/matchmake');
    const reconnecting = path.startsWith('/matchmake/reconnect/');
    const databaseApi =
      path.startsWith('/api/') && !['/api/token', '/api/auth/discord/session'].includes(path);
    if (
      (matchmaking && !reconnecting && !lifecycle.isReady) ||
      (databaseApi && !lifecycle.databaseReady)
    ) {
      res.setHeader('Retry-After', '5');
      res.status(503).json({
        code: 503,
        error: lifecycle.isDraining
          ? 'The server is restarting. Please try again shortly.'
          : 'The game service is temporarily unavailable. Please try again shortly.',
      });
      return;
    }
    next();
  };
}

interface DrainDependencies {
  activeRooms: () => Promise<number>;
  shutdown: () => Promise<void>;
  drainMs: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

/** Wait for current games, then let the framework dispose rooms and close transport. */
export async function drainActiveGames(dependencies: DrainDependencies): Promise<void> {
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + dependencies.drainMs;
  while (now() < deadline && (await dependencies.activeRooms()) > 0) {
    await wait(Math.min(250, deadline - now()));
  }
  await dependencies.shutdown();
}
