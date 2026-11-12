import mongoose from 'mongoose';
import * as Sentry from '@sentry/node';
import { serverLifecycle } from './lifecycle';

type Job = { run: () => Promise<void>; attempts: number; retryAt: number; running: boolean };

/** Bounded retries for immutable, idempotent match results while this process lives. */
export class ResultQueue {
  private readonly jobs = new Map<string, Job>();
  private timer?: ReturnType<typeof setTimeout>;
  private active = 0;

  constructor(
    private readonly connected: () => boolean,
    private readonly onError: (error: unknown, id: string) => void,
    private readonly capacity = 1000,
  ) {}

  get pendingCount() {
    return this.jobs.size;
  }

  get failedCount() {
    return [...this.jobs.values()].filter((job) => job.attempts > 0 || !this.connected()).length;
  }

  enqueue(id: string, run: () => Promise<void>): void {
    if (this.jobs.has(id)) return;
    if (this.jobs.size >= this.capacity) throw new Error('Result retry queue is full');
    this.jobs.set(id, { run, attempts: 0, retryAt: 0, running: false });
    this.schedule(0);
  }

  private schedule(ms: number) {
    if (this.timer || this.jobs.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pump();
    }, ms);
    this.timer.unref();
  }

  private pump() {
    if (this.connected()) {
      for (const [id, job] of this.jobs) {
        if (this.active >= 4) break;
        if (job.running || job.retryAt > Date.now()) continue;
        job.running = true;
        this.active++;
        void Promise.resolve()
          .then(job.run)
          .then(() => this.jobs.delete(id))
          .catch((error: unknown) => {
            job.attempts++;
            job.retryAt = Date.now() + Math.min(10_000, 250 * 2 ** Math.min(job.attempts, 6));
            try {
              this.onError(error, id);
            } catch {
              // Reporting must not turn a retained retry into an unhandled rejection.
            }
          })
          .finally(() => {
            job.running = false;
            this.active--;
            this.schedule(250);
          });
      }
    }
    this.schedule(250);
  }

  async flush(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    // Recovery just before shutdown must not wait out an old ten-second backoff.
    for (const job of this.jobs.values()) if (!job.running) job.retryAt = 0;
    this.pump();
    while (this.jobs.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return this.jobs.size === 0;
  }
}

const resultQueue = new ResultQueue(
  // Wait for startup (indexes) to finish, not just the socket, before writing results.
  () => serverLifecycle.databaseReady && mongoose.connection.readyState === 1,
  (error, resultId) => {
    Sentry.captureException(error, { tags: { resultId } });
    console.error('Match result persistence deferred; retrying', { resultId, error });
  },
);

export const enqueueResult = (id: string, run: () => Promise<void>) => resultQueue.enqueue(id, run);
export const getPendingResultCount = () => resultQueue.pendingCount;
export const getFailedResultCount = () => resultQueue.failedCount;
export const flushPendingResults = (timeoutMs: number) => resultQueue.flush(timeoutMs);
