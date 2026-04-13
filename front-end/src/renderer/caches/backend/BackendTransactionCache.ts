import { inject, provide } from 'vue';
import { TransactionId } from '@hiero-ledger/sdk';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';

export class BackendTransactionCache extends EntityCache<number | string, ITransactionFull> {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public static provide(): void {
    provide(BackendTransactionCache.injectKey, new BackendTransactionCache());
  }

  public static inject(): BackendTransactionCache {
    const defaultFactory = () => new BackendTransactionCache();
    return inject<BackendTransactionCache>(BackendTransactionCache.injectKey, defaultFactory, true);
  }

  public forgetTransaction(transaction: ITransactionFull, serverUrl: string): void {
    this.forget(transaction.id, serverUrl);
    this.forget(transaction.transactionId, serverUrl);
  }

  public async preload(transactionIds: Array<number | string>, serverUrl: string): Promise<void> {
    for (const id of transactionIds) {
      await this.lookup(id, serverUrl);
    }
  }

  //
  // EntityCache
  //

  protected override async load(id: number | string, serverUrl: string): Promise<ITransactionFull> {
    const tid = typeof id === 'string' ? TransactionId.fromString(id) : id;
    return await getTransactionById(serverUrl, tid);
  }

  public override async lookup(id: number | string, serverUrl: string): Promise<ITransactionFull> {
    const p = super.lookup(id, serverUrl);
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
