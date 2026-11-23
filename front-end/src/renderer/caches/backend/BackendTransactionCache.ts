import { TransactionId } from '@hiero-ledger/sdk';
import { EntityCache } from '@renderer/caches/base/EntityCache';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';

// Transactions are cached by database id only, so forget() is always complete.
// Callers that only know the SDK transaction id (e.g. file imports) use fetchBySdkId(),
// which bypasses the cache.
export class BackendTransactionCache extends EntityCache<number, ITransactionFull> {
  // Transactions are mutable and status-bearing: keep entries short-lived so that
  // a missed websocket event can only leave stale data for a few seconds.
  public static readonly TTL = 10_000; // ms

  public constructor() {
    super(BackendTransactionCache.TTL);
  }

  //
  // Public
  //

  public async fetchBySdkId(sdkTransactionId: string, serverUrl: string): Promise<ITransactionFull> {
    return await getTransactionById(serverUrl, TransactionId.fromString(sdkTransactionId));
  }

  public forgetTransaction(transaction: ITransactionFull, serverUrl: string): void {
    this.forget(transaction.id, serverUrl);
  }

  //
  // EntityCache
  //

  protected override async load(id: number, serverUrl: string): Promise<ITransactionFull> {
    return await getTransactionById(serverUrl, id);
  }
}
