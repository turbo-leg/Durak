import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultQueue } from '../src/operations/resultQueue';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('result queue pressure and deadline handling', () => {
  it('limits active writes and keeps duplicate enqueue calls from replaying an active result', async () => {
    vi.useFakeTimers();
    const releases: Array<() => void> = [];
    let started = 0;
    let active = 0;
    let peak = 0;
    const queue = new ResultQueue(() => true, vi.fn());
    const write = () => {
      started++;
      active++;
      peak = Math.max(peak, active);
      return new Promise<void>((resolve) =>
        releases.push(() => {
          active--;
          resolve();
        }),
      );
    };
    for (let i = 0; i < 12; i++) queue.enqueue(`result-${i}`, write);
    queue.enqueue('result-0', write);
    await vi.advanceTimersByTimeAsync(10);
    expect(started).toBe(4);
    expect(queue.failedCount).toBe(0);
    while (queue.pendingCount) {
      releases.splice(0).forEach((release) => release());
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(started).toBe(12);
    expect(peak).toBe(4);
  });

  it('honors flush deadlines even when an in-flight database call never returns', async () => {
    vi.useFakeTimers();
    const queue = new ResultQueue(() => true, vi.fn());
    const write = vi.fn(() => new Promise<void>(() => {}));
    queue.enqueue('hung-write', write);
    await vi.advanceTimersByTimeAsync(1);
    const flushed = queue.flush(75);
    await vi.advanceTimersByTimeAsync(100);
    expect(await flushed).toBe(false);
    expect(queue.pendingCount).toBe(1);
    expect(write).toHaveBeenCalledOnce();
  });
});
