import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { TransactionByIdResponse } from '@shared/interfaces';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService.ts';
import axios from 'axios';

export class TransactionByIdCache extends EntityCache<string, TransactionByIdResponse | null> {
  private static readonly injectKey = Symbol();
  private static readonly LENGTHY = 10 * 3600_000;

  //
  // Public
  //

  public constructor() {
    super(TransactionByIdCache.LENGTHY, TransactionByIdCache.LENGTHY); // transactions are immutable data so we load them one time
  }

  public static provide(): void {
    provide(TransactionByIdCache.injectKey, new TransactionByIdCache());
  }

  public static inject(): TransactionByIdCache {
    const defaultFactory = () => new TransactionByIdCache();
    return inject<TransactionByIdCache>(TransactionByIdCache.injectKey, defaultFactory, true);
  }

  //
  // EntityCache
  //

  protected override async load(
    transactionId: string,
    mirrorNodeLink: string,
  ): Promise<TransactionByIdResponse | null> {
    let result: Promise<TransactionByIdResponse | null>;
    try {
      result = getTransactionInfo(transactionId, mirrorNodeLink);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 404) {
        result = Promise.resolve(null);
      } else {
        throw error;
      }
    }
    return result;
  }
}
