interface ConnectRetryOptions {
  connect: () => Promise<void>;
  /** Close a half-open connection before the next try. */
  reset: () => Promise<void>;
  onError: (error: unknown, attempt: number, retryMs: number) => void;
  /** Stop retrying once the server begins shutting down. */
  stopped: () => boolean;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Keep trying the first database connection with backoff (2 s doubling to 60 s) instead
 * of exiting. The driver handles reconnects after the first success. Returns true once
 * connected, false if the server stopped first.
 */
export async function connectWithRetry(options: ConnectRetryOptions): Promise<boolean> {
  const wait =
    options.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref()));
  for (let attempt = 1; !options.stopped(); attempt++) {
    try {
      await options.connect();
      return true;
    } catch (error) {
      const retryMs = Math.min(60_000, 2000 * 2 ** Math.min(attempt - 1, 5));
      options.onError(error, attempt, retryMs);
      await options.reset().catch(() => {});
      await wait(retryMs);
    }
  }
  return false;
}
