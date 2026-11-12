import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { ContractExecutionResult } from '@renderer/services/mirrorNodeDataService.ts';
import { getContractExecutionResult } from '@renderer/services/mirrorNodeDataService.ts';

export class ContractResultByTransactionIdCache extends EntityCache<
  string,
  ContractExecutionResult | null
> {
  // A contract's execution result for a given transaction never changes once it exists,
  // unlike the mutable mirror-node entities the other caches store - so never expire it.
  public constructor() {
    super(Infinity);
  }

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
