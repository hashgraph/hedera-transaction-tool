import { TransactionId } from '@hiero-ledger/sdk';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';
import type { Organization } from '@prisma/client';

export class BackendTransactionCache extends EntityCache<number | string, ITransactionFull, Organization> {
  //
  // Public
  //

  public forgetTransaction(transaction: ITransactionFull, organization: Organization): void {
    this.forget(transaction.id, organization);
    this.forget(transaction.transactionId, organization);
  }

  //
  // EntityCache
  //

  protected override async load(
    id: number | string,
    organization: Organization,
  ): Promise<ITransactionFull> {
    const tid = typeof id === 'string' ? TransactionId.fromString(id) : id;
    return await getTransactionById(organization, tid);
  }

  override makeRecordKey(key: string | number, organization: Organization): string {
    return key.toString() + '/' + organization.serverUrl;
  }

  public override async lookup(
    id: number | string,
    context: Organization,
    forceLoad = false,
  ): Promise<ITransactionFull> {
    const p = super.lookup(id, context, forceLoad);
    const result = await p;
    if (typeof id === 'number') {
      // We insert an entry with the string key
      this.mutate(result.transactionId, context, p);
    } else {
      // We insert an entry with number key
      this.mutate(result.id, context, p);
    }
    return result;
  }
}
