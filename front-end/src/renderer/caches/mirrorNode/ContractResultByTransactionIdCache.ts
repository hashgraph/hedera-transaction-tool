import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { ContractExecutionResult } from '@renderer/services/mirrorNodeDataService.ts';
import { getContractExecutionResult } from '@renderer/services/mirrorNodeDataService.ts';

export class ContractResultByTransactionIdCache extends EntityCache<
  string,
  ContractExecutionResult | null
> {
  //
  // EntityCache
  //

  protected override async load(
    transactionId: string,
    mirrorNodeLink: string,
  ): Promise<ContractExecutionResult | null> {
    return getContractExecutionResult(transactionId, mirrorNodeLink);
  }
}
