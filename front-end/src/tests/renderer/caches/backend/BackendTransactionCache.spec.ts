import { TransactionId } from '@hiero-ledger/sdk';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EntityCache } from '@renderer/caches/base/EntityCache';
import { BackendTransactionCache } from '@renderer/caches/backend/BackendTransactionCache';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';

vi.mock('@renderer/services/organization', () => ({ getTransactionById: vi.fn() }));

const URL = 'https://org.example.com';
const SDK_ID = '0.0.2@1700000000.000000000';

const makeTx = (status: string): ITransactionFull =>
  ({ id: 7, transactionId: SDK_ID, status }) as unknown as ITransactionFull;

describe('BackendTransactionCache', () => {
  const getMock = vi.mocked(getTransactionById);
  let cache: BackendTransactionCache;

  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
    cache = new BackendTransactionCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Note: this checks behaviour only. The original bug was in the call sites (forget(id, url, false)
  // skipped entries younger than 1s), which this cache API no longer allows.
  test('an event right after a fetch invalidates the entry (issue #3733)', async () => {
    // Client fetches while the transaction is still waiting for execution...
    getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
    await cache.lookup(7, URL);

    // ...and the status-update event arrives well within a second of that fetch
    vi.advanceTimersByTime(300);
    cache.forget(7, URL);

    getMock.mockResolvedValue(makeTx('EXECUTED'));
    expect((await cache.lookup(7, URL)).status).toBe('EXECUTED');
  });

  test('concurrent lookups share a single fetch', async () => {
    let resolve!: (tx: ITransactionFull) => void;
    getMock.mockReturnValue(new Promise(r => (resolve = r)));

    const first = cache.lookup(7, URL);
    const second = cache.lookup(7, URL);
    resolve(makeTx('WAITING_FOR_EXECUTION'));

    expect(await first).toBe(await second);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  test('an entry is served from cache until the TTL, then refetched', async () => {
    getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
    await cache.lookup(7, URL);

    vi.advanceTimersByTime(BackendTransactionCache.TTL - 1_000);
    await cache.lookup(7, URL);
    expect(getMock).toHaveBeenCalledTimes(1);

    // An entry stays usable for TTL + FRESH_DURATION
    vi.advanceTimersByTime(1_000 + EntityCache.FRESH_DURATION);
    await cache.lookup(7, URL);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  describe('fetchBySdkId', () => {
    test('always fetches and never caches', async () => {
      getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
      await cache.fetchBySdkId(SDK_ID, URL);
      await cache.fetchBySdkId(SDK_ID, URL);
      expect(getMock).toHaveBeenCalledTimes(2);
    });

    test('does not populate the numeric cache', async () => {
      getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
      await cache.fetchBySdkId(SDK_ID, URL);
      await cache.lookup(7, URL);
      expect(getMock).toHaveBeenCalledTimes(2);
    });

    test('parses the SDK id before calling the backend', async () => {
      getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
      await cache.fetchBySdkId(SDK_ID, URL);
      expect(getMock).toHaveBeenCalledWith(URL, TransactionId.fromString(SDK_ID));
    });

    test('is not affected by forgetting the numeric entry', async () => {
      getMock.mockResolvedValue(makeTx('EXECUTED'));
      cache.forget(7, URL);
      expect((await cache.fetchBySdkId(SDK_ID, URL)).status).toBe('EXECUTED');
    });
  });

  test('forgetTransaction removes the numeric entry', async () => {
    getMock.mockResolvedValue(makeTx('WAITING_FOR_EXECUTION'));
    const tx = await cache.lookup(7, URL);

    cache.forgetTransaction(tx, URL);

    getMock.mockResolvedValue(makeTx('EXECUTED'));
    expect((await cache.lookup(7, URL)).status).toBe('EXECUTED');
  });
});
