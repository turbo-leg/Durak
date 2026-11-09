import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ID = /^[a-f0-9]{24}$/;
const RECORD = /^([a-f0-9]{24})\.json$/;
const TEMPORARY = /^\.[a-f0-9]{24}\.[a-f0-9-]{36}\.tmp$/;
const MAX_RECORDS = 1000;
const MAX_BYTES = 1024 * 1024;

/**
 * A process-owned directory of JSON results awaiting durable database writes.
 * Keep one instance per directory: its serialized operations enforce capacity.
 * Temporary files are uncommitted writes and are never replayed after restart.
 * File content and directory metadata are synced on supported filesystems.
 * Windows may reject directory handles/sync; file data is still synced there,
 * but rename/removal metadata cannot receive the same power-loss guarantee.
 */
export class ResultOutbox<T> {
  private pending: Promise<void> = Promise.resolve();
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = path.resolve(directory);
  }

  put(id: string, payload: T): Promise<void> {
    return this.exclusive(async () => {
      this.validateId(id);
      const serialized = JSON.stringify({ id, payload });
      if (!Object.hasOwn(JSON.parse(serialized), 'payload')) {
        throw new Error('Result outbox payload must be JSON serializable');
      }
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
        throw new Error(`Result outbox record exceeds ${MAX_BYTES} bytes`);
      }
      const records = await this.records();
      const filename = `${id}.json`;
      if (records.length >= MAX_RECORDS && !records.includes(filename)) {
        throw new Error(`Result outbox capacity of ${MAX_RECORDS} records reached`);
      }

      const temporary = path.join(this.directory, `.${id}.${randomUUID()}.tmp`);
      const destination = path.join(this.directory, filename);
      try {
        const file = await fs.open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(serialized, 'utf8');
          await file.sync();
        } finally {
          await file.close();
        }
        await fs.rename(temporary, destination);
        await this.syncDirectory();
      } finally {
        await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
    });
  }

  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      this.validateId(id);
      try {
        await fs.unlink(path.join(this.directory, `${id}.json`));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      await this.syncDirectory();
    });
  }

  readAll(): Promise<Array<{ id: string; payload: T }>> {
    return this.exclusive(async () => {
      const restored: Array<{ id: string; payload: T }> = [];
      for (const filename of await this.records()) {
        const file = await fs.open(path.join(this.directory, filename), 'r');
        let serialized: string;
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.size > MAX_BYTES) {
            throw new Error(`Invalid or oversized result outbox record: ${filename}`);
          }
          serialized = await file.readFile('utf8');
        } finally {
          await file.close();
        }
        if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
          throw new Error(`Oversized result outbox record: ${filename}`);
        }
        let record: unknown;
        try {
          record = JSON.parse(serialized);
        } catch {
          throw new Error(`Corrupt result outbox JSON: ${filename}`);
        }
        if (
          record === null ||
          typeof record !== 'object' ||
          Array.isArray(record) ||
          !('id' in record) ||
          typeof record.id !== 'string' ||
          record.id !== filename.slice(0, -5) ||
          !('payload' in record) ||
          !Object.hasOwn(record, 'payload')
        ) {
          throw new Error(`Invalid result outbox envelope: ${filename}`);
        }
        restored.push({ id: record.id, payload: record.payload as T });
      }
      return restored;
    });
  }

  private validateId(id: string): void {
    if (typeof id !== 'string' || !ID.test(id)) {
      throw new Error('Result outbox ID must be 24 lowercase hexadecimal characters');
    }
  }

  private async syncDirectory(): Promise<void> {
    let directory: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      directory = await fs.open(this.directory, 'r');
      await directory.sync();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Node cannot consistently open or fsync directory handles on Windows.
      // EIO, ENOSPC, and errors on supported platforms must reach the caller.
      if (process.platform === 'win32' && ['EISDIR', 'EPERM', 'EINVAL'].includes(code ?? ''))
        return;
      throw error;
    } finally {
      await directory?.close();
    }
  }

  private async records(): Promise<string[]> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const records: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) throw new Error(`Invalid result outbox entry: ${entry.name}`);
      if (TEMPORARY.test(entry.name)) continue;
      if (!RECORD.test(entry.name))
        throw new Error(`Invalid result outbox filename: ${entry.name}`);
      records.push(entry.name);
    }
    if (records.length > MAX_RECORDS) {
      throw new Error(`Result outbox exceeds capacity of ${MAX_RECORDS} records`);
    }
    return records.sort();
  }

  private exclusive<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.pending.then(operation);
    this.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
