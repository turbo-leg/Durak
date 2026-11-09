import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultQueue } from '../src/operations/resultQueue';

afterEach(() => vi.useRealTimers());

describe('result persistence retries', () => {
  it('retains a result through disconnection and retries a failed write once available', async () => {
    vi.useFakeTimers();
    let connected = false;
    const error = new Error('database interrupted');
    const write = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const report = vi.fn();
    const queue = new ResultQueue(() => connected, report);
    queue.enqueue('match-1', write);
    queue.enqueue('match-1', write);
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).not.toHaveBeenCalled();
    expect(queue.pendingCount).toBe(1);
    expect(queue.failedCount).toBe(1);
    connected = true;
    await vi.advanceTimersByTimeAsync(250);
    expect(queue.failedCount).toBe(1);
    expect(report).toHaveBeenCalledWith(error, 'match-1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(queue.pendingCount).toBe(0);
  });

  it('bounds retained work and reports a timed-out drain without discarding results', async () => {
    vi.useFakeTimers();
    const queue = new ResultQueue(() => false, vi.fn(), 1);
    queue.enqueue('match-1', vi.fn());
    expect(() => queue.enqueue('match-2', vi.fn())).toThrow('full');
    const flushed = queue.flush(50);
    await vi.advanceTimersByTimeAsync(75);
    expect(await flushed).toBe(false);
    expect(queue.pendingCount).toBe(1);
    vi.clearAllTimers();
  });
});
