import { TransactionId } from '@hiero-ledger/sdk';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';

export class BackendTransactionCache extends EntityCache<number | string, ITransactionFull> {
  //
  // Public
  //

  public forgetTransaction(transaction: ITransactionFull, serverUrl: string): void {
    this.forget(transaction.id, serverUrl);
    this.forget(transaction.transactionId, serverUrl);
  }

  //
  // EntityCache
  //

  protected override async load(id: number | string, serverUrl: string): Promise<ITransactionFull> {
    const tid = typeof id === 'string' ? TransactionId.fromString(id) : id;
    return await getTransactionById(serverUrl, tid);
  }

  public override async lookup(
    id: number | string,
    serverUrl: string,
    forceLoad = false,
  ): Promise<ITransactionFull> {
    const p = super.lookup(id, serverUrl, forceLoad);
    const result = await p;
    if (typeof id === 'number') {
      // We insert an entry with the string key
      this.mutate(result.transactionId, serverUrl, p);
    } else {
      // We insert an entry with number key
      this.mutate(result.id, serverUrl, p);
    }
    return result;
  }
}
