import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@hiero-ledger/sdk';

import { getClientFromNetwork } from '../utils/sdk';

interface PoolEntry {
  clientPromise: Promise<Client>;
  refCount: number;
  idleTimer?: NodeJS.Timeout;
}

const DEFAULT_IDLE_MS = 5 * 60 * 1000;

/**
 * Reference-counted, per-network pool of Hedera SDK Clients.
 *
 * An idle Client is held open for `idleMs` after its last release so bursty
 * traffic reuses the same gRPC channels and (for custom mirror networks) the
 * same address book. When all entries are idle and the timer fires, the Client
 * is closed and dropped; the next acquire builds a fresh one — which gives us
 * eventual address-book refresh "for free" without an explicit schedule.
 */
@Injectable()
export class HederaClientPool implements OnModuleDestroy {
  private readonly logger = new Logger(HederaClientPool.name);
  private readonly entries = new Map<string, PoolEntry>();
  private readonly idleMs: number;

  constructor(idleMs: number = DEFAULT_IDLE_MS) {
    this.idleMs = idleMs;
  }

  async acquire(network: string): Promise<Client> {
    const key = this.normalizeKey(network);
    let entry = this.entries.get(key);

    if (!entry) {
      // Evict the entry from the cache if the underlying build fails so the
      // next caller retries with a fresh attempt instead of latching onto a
      // rejected promise forever.
      const newEntry: PoolEntry = {
        clientPromise: getClientFromNetwork(network).catch(err => {
          if (this.entries.get(key) === newEntry) {
            this.entries.delete(key);
          }
          throw err;
        }),
        refCount: 0,
      };
      entry = newEntry;
      this.entries.set(key, entry);
    }

    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = undefined;
    }
    entry.refCount++;

    try {
      return await entry.clientPromise;
    } catch (err) {
      // The build failed; balance our increment so the orphan entry's count
      // reflects only callers that are still awaiting.
      entry.refCount--;
      throw err;
    }
  }

  release(network: string): void {
    const key = this.normalizeKey(network);
    const entry = this.entries.get(key);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount > 0) return;

    entry.refCount = 0;
    entry.idleTimer = setTimeout(() => {
      void this.closeEntry(key);
    }, this.idleMs);
    // Don't keep the event loop alive solely for the idle timer.
    entry.idleTimer.unref?.();
  }

  async withClient<T>(network: string, fn: (client: Client) => Promise<T>): Promise<T> {
    const client = await this.acquire(network);
    try {
      return await fn(client);
    } finally {
      this.release(network);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const keys = Array.from(this.entries.keys());
    await Promise.all(keys.map(key => this.closeEntry(key)));
  }

  private async closeEntry(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
    }
    try {
      const client = await entry.clientPromise;
      client.close();
    } catch (err) {
      this.logger.debug(
        `Skipping close for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private normalizeKey(network: string): string {
    return network.toLocaleLowerCase();
  }
}
