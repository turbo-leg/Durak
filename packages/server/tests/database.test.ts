import { describe, expect, it, vi } from 'vitest';
import { connectWithRetry } from '../src/operations/database';

describe('connectWithRetry', () => {
  it('keeps retrying with backoff instead of failing, then connects', async () => {
    const waits: number[] = [];
    let attempts = 0;
    const onError = vi.fn();
    const reset = vi.fn(async () => {});
    const connected = await connectWithRetry({
      connect: async () => {
        attempts++;
        if (attempts < 4) throw new Error('querySrv ENOTFOUND');
      },
      reset,
      onError,
      stopped: () => false,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    expect(connected).toBe(true);
    expect(attempts).toBe(4);
    expect(waits).toEqual([2000, 4000, 8000]);
    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError.mock.calls[2]?.[1]).toBe(3);
    // A half-open connection is closed before every retry.
    expect(reset).toHaveBeenCalledTimes(3);
  });

  it('caps the backoff at a minute', async () => {
    const waits: number[] = [];
    let attempts = 0;
    await connectWithRetry({
      connect: async () => {
        if (++attempts < 10) throw new Error('down');
      },
      reset: async () => {},
      onError: () => {},
      stopped: () => false,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    expect(Math.max(...waits)).toBe(60_000);
  });

  it('stops retrying once the server starts shutting down', async () => {
    let draining = false;
    let attempts = 0;
    const connected = await connectWithRetry({
      connect: async () => {
        attempts++;
        throw new Error('down');
      },
      reset: async () => {},
      onError: () => {},
      stopped: () => draining,
      wait: async () => {
        if (attempts === 2) draining = true;
      },
    });
    expect(connected).toBe(false);
    expect(attempts).toBe(2);
  });

  it('survives a reset that throws', async () => {
    let attempts = 0;
    const connected = await connectWithRetry({
      connect: async () => {
        if (++attempts < 2) throw new Error('down');
      },
      reset: async () => {
        throw new Error('not connected');
      },
      onError: () => {},
      stopped: () => false,
      wait: async () => {},
    });
    expect(connected).toBe(true);
  });
});
