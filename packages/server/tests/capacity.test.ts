import { describe, expect, it } from 'vitest';
import { CapacityError, ProcessCapacity } from '../src/operations/capacity';

const budget = () => new ProcessCapacity({ maxRooms: 2, maxClients: 2, maxBots: 1 });

describe('process admission budget', () => {
  it('caps new rooms and releases their claims idempotently on disposal', () => {
    const capacity = budget();
    capacity.claimRoom('a');
    capacity.claimRoom('a');
    capacity.claimRoom('b');
    expect(() => capacity.claimRoom('c')).toThrow(CapacityError);
    capacity.claimClient('a', 'player');
    capacity.claimBot('a', 'bot');
    capacity.releaseRoom('a');
    capacity.releaseRoom('a');
    expect(capacity.snapshot()).toMatchObject({ rooms: 1, clients: 0, bots: 0 });
    capacity.claimRoom('c');
  });

  it('enforces client caps across rooms, including a race after successful preflight', () => {
    const capacity = budget();
    capacity.claimRoom('a');
    capacity.claimRoom('b');
    capacity.claimClient('a', 'player');
    capacity.assertAvailableClient();
    capacity.assertAvailableClient();
    capacity.claimClient('b', 'other');
    expect(() => capacity.claimClient('a', 'racing')).toThrow(CapacityError);
    expect(capacity.snapshot().clients).toBe(2);
  });

  it('permits a retained connection claim to reconnect at capacity', () => {
    const capacity = budget();
    capacity.claimRoom('a');
    capacity.claimClient('a', 'one');
    capacity.claimClient('a', 'two');
    expect(() => capacity.assertAvailableClient('a', 'one')).not.toThrow();
    capacity.claimClient('a', 'one');
    expect(capacity.snapshot().clients).toBe(2);
    capacity.releaseClient('a', 'one');
    capacity.releaseClient('a', 'one');
    capacity.claimClient('a', 'three');
    expect(capacity.snapshot().clients).toBe(2);
  });

  it('caps permanent and stand-in bot claims independently of human clients', () => {
    const capacity = budget();
    capacity.claimRoom('a');
    capacity.claimRoom('b');
    capacity.claimBot('a', 'one');
    capacity.claimBot('a', 'one');
    expect(() => capacity.claimBot('b', 'standin')).toThrow(CapacityError);
    capacity.releaseBot('a', 'one');
    capacity.releaseBot('a', 'one');
    capacity.claimBot('b', 'standin');
    capacity.claimClient('b', 'player');
    expect(capacity.snapshot()).toMatchObject({ bots: 1, clients: 1 });
  });

  it('rejects invalid capacity settings instead of disabling protection', () => {
    expect(() => new ProcessCapacity({ maxRooms: 0, maxClients: 2, maxBots: 1 })).toThrow();
    expect(() => new ProcessCapacity({ maxRooms: 2, maxClients: Infinity, maxBots: 1 })).toThrow();
  });
});
