import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import type { BotPolicy } from '../src/ai/BotPolicy';
import type { MatchResult } from './botMatch';
import type { BotAttackModel } from '../src/ai/BotAttackModel';

export interface MatchSpec {
  seed: number;
  seat: number;
  policy: BotPolicy;
  options: {
    players?: number;
    mixedOpponents?: boolean;
    incumbent?: BotPolicy;
    opponents?: BotPolicy[];
    candidateModel?: BotAttackModel | null;
    incumbentModel?: BotAttackModel | null;
  };
}

interface Task {
  id: number;
  matches: MatchSpec[];
  resolve: (results: MatchResult[]) => void;
  reject: (error: Error) => void;
}

export class BotMatchPool {
  private workers: Array<{ worker: Worker; busy: boolean }> = [];
  private queue: Task[] = [];
  private active = new Map<number, Task>();
  private nextId = 0;
  private failure: Error | null = null;

  constructor(count: number) {
    if (!Number.isInteger(count) || count < 1)
      throw new Error('workers must be a positive integer');
    for (let i = 0; i < count; i++) {
      const worker = new Worker(resolve(__dirname, '../../../scripts/bot-match-worker.mjs'));
      const slot = { worker, busy: false };
      this.workers.push(slot);
      worker.on('message', (message: { id: number; results?: MatchResult[]; error?: string }) => {
        const task = this.active.get(message.id);
        if (!task) return;
        this.active.delete(message.id);
        slot.busy = false;
        if (message.error) task.reject(new Error(message.error));
        else task.resolve(message.results ?? []);
        this.dispatch();
      });
      worker.on('error', (error) => this.fail(error));
      worker.on('exit', (code) => {
        if (code !== 0 && !this.failure) this.fail(new Error(`Bot match worker exited ${code}`));
      });
    }
  }

  run(matches: MatchSpec[]): Promise<MatchResult[]> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, matches, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch(): void {
    for (const slot of this.workers) {
      if (slot.busy) continue;
      const task = this.queue.shift();
      if (!task) break;
      slot.busy = true;
      this.active.set(task.id, task);
      slot.worker.postMessage({ id: task.id, matches: task.matches });
    }
  }

  private fail(error: Error): void {
    this.failure = error;
    for (const task of [...this.queue, ...this.active.values()]) task.reject(error);
    this.queue = [];
    this.active.clear();
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((slot) => slot.worker.terminate()));
  }
}
