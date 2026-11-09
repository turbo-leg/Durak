import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ResultOutbox } from '../src/operations/resultOutbox';

const outputRoot = path.resolve(__dirname, '../../../output');
const id = (n: number) => n.toString(16).padStart(24, '0');
let directory: string;
let outbox: ResultOutbox<{ winner: string }>;

beforeEach(async () => {
  await fs.mkdir(outputRoot, { recursive: true });
  directory = await fs.mkdtemp(path.join(outputRoot, 'result-outbox-test-'));
  outbox = new ResultOutbox(directory);
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (!path.resolve(directory).startsWith(outputRoot + path.sep)) {
    throw new Error('Refusing to remove an outbox test directory outside the workspace output');
  }
  await fs.rm(directory, { recursive: true, force: true });
});

describe('durable result outbox', () => {
  it('restores results in a new instance and removes a replayed result idempotently', async () => {
    await outbox.put(id(1), { winner: 'Ana' });
    await outbox.put(id(2), { winner: 'Mira' });
    const restored = new ResultOutbox<{ winner: string }>(directory);
    expect(await restored.readAll()).toEqual([
      { id: id(1), payload: { winner: 'Ana' } },
      { id: id(2), payload: { winner: 'Mira' } },
    ]);
    await restored.remove(id(1));
    await restored.remove(id(1));
    expect(await new ResultOutbox(directory).readAll()).toEqual([
      { id: id(2), payload: { winner: 'Mira' } },
    ]);
  });

  it.each(['../outside', 'A'.repeat(24), 'a'.repeat(23), 'a'.repeat(25), 'a'.repeat(24) + '/x'])(
    'rejects unsafe or noncanonical record IDs: %s',
    async (invalid) => {
      await expect(outbox.put(invalid, { winner: 'Ana' })).rejects.toThrow(/ID/);
      await expect(outbox.remove(invalid)).rejects.toThrow(/ID/);
      expect(await fs.readdir(directory)).toEqual([]);
    },
  );

  it('keeps the previous committed record if an atomic rename fails and allows a later retry', async () => {
    await outbox.put(id(1), { winner: 'Ana' });
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('simulated storage failure'));
    await expect(outbox.put(id(1), { winner: 'Mira' })).rejects.toThrow(
      'simulated storage failure',
    );
    expect(await fs.readdir(directory)).toEqual([`${id(1)}.json`]);
    expect(await outbox.readAll()).toEqual([{ id: id(1), payload: { winner: 'Ana' } }]);
    await outbox.put(id(1), { winner: 'Mira' });
    expect(await outbox.readAll()).toEqual([{ id: id(1), payload: { winner: 'Mira' } }]);
  });

  it('bounds record bytes before writing and preserves existing data when a payload is invalid', async () => {
    await outbox.put(id(1), { winner: 'Ana' });
    await expect(outbox.put(id(1), { winner: 'é'.repeat(600_000) })).rejects.toThrow(/bytes/);
    await expect(new ResultOutbox<undefined>(directory).put(id(2), undefined)).rejects.toThrow(
      /JSON serializable/,
    );
    expect(await fs.readdir(directory)).toEqual([`${id(1)}.json`]);
    expect(await outbox.readAll()).toEqual([{ id: id(1), payload: { winner: 'Ana' } }]);
  });

  it.each([
    ['broken JSON', '{unfinished'],
    ['mismatched ID', JSON.stringify({ id: id(2), payload: {} })],
    ['missing payload', JSON.stringify({ id: id(1) })],
    ['array envelope', '[]'],
    ['oversized record', 'x'.repeat(1024 * 1024 + 1)],
  ])('refuses to replay a %s instead of silently skipping it', async (_description, contents) => {
    await fs.writeFile(path.join(directory, `${id(1)}.json`), contents);
    await expect(outbox.readAll()).rejects.toThrow(/outbox/);
  });

  it('rejects unexpected filenames and nested directories', async () => {
    await fs.writeFile(path.join(directory, 'unexpected.json'), '{}');
    await expect(outbox.readAll()).rejects.toThrow(/filename/);
    await fs.unlink(path.join(directory, 'unexpected.json'));
    await fs.mkdir(path.join(directory, `${id(1)}.json`));
    await expect(outbox.readAll()).rejects.toThrow(/entry/);
  });

  it('never replays an incomplete temporary write after restart', async () => {
    await outbox.put(id(1), { winner: 'Ana' });
    await fs.writeFile(
      path.join(directory, `.${id(2)}.12345678-1234-1234-1234-123456789abc.tmp`),
      '{unfinished',
    );
    expect(await new ResultOutbox(directory).readAll()).toEqual([
      { id: id(1), payload: { winner: 'Ana' } },
    ]);
  });

  it('serializes concurrent writes at capacity, while allowing replacement and deletion', async () => {
    await Promise.all(
      Array.from({ length: 999 }, (_, n) =>
        fs.writeFile(
          path.join(directory, `${id(n)}.json`),
          JSON.stringify({ id: id(n), payload: { winner: 'Ana' } }),
        ),
      ),
    );
    const pending = await Promise.allSettled([
      outbox.put(id(999), { winner: 'Mira' }),
      outbox.put(id(1000), { winner: 'Kai' }),
    ]);
    expect(pending[0].status).toBe('fulfilled');
    expect(pending[1].status).toBe('rejected');
    await outbox.put(id(999), { winner: 'Kai' });
    expect(await outbox.readAll()).toHaveLength(1000);
    await outbox.remove(id(0));
    await outbox.put(id(1000), { winner: 'Ana' });
    expect(await outbox.readAll()).toHaveLength(1000);
  }, 15_000);
});
