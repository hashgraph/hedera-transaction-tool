import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { TransactionByIdResponse } from '@shared/interfaces';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService.ts';
import axios from 'axios';

export class TransactionByIdCache extends EntityCache<string, TransactionByIdResponse | null> {
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
