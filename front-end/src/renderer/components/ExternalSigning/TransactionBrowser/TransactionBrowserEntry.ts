import { Transaction as SDKTransaction } from '@hashgraph/sdk';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { computeSignatureKey, hexToUint8Array, type SignatureAudit } from '@renderer/utils';
import {
  filterAuditByUser,
  filterTransactionSignersByUser,
} from '@shared/utils/transactionFile.ts';

export class TransactionBrowserEntry {
  public readonly fullySignedByUser: boolean;
  public constructor(
    public readonly item: ITransactionBrowserItem,
    public readonly transaction: SDKTransaction | null, // null means decoding failed
    public readonly signatureAudit: SignatureAudit | null, // null if transaction is null
    userKeys: string[],
  ) {
    this.fullySignedByUser = this.isFullySignedByUser(userKeys);
  }

  public isFullySignedByUser(userKeys: string[]): boolean {
    let result: boolean;
    if (this.transaction !== null && this.signatureAudit !== null) {
      const requiredKeys = filterAuditByUser(this.signatureAudit, userKeys);
      const signingKeys = filterTransactionSignersByUser(this.transaction, userKeys);
      result = requiredKeys.size >= 1 && signingKeys.size == requiredKeys.size;
    } else {
      result = false;
    }
    return result;
  }

  //
  // Static
  //

  public static async make(
    item: ITransactionBrowserItem,
    mirrorNetwork: string,
    accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
    userKeys: string[],
  ): Promise<TransactionBrowserEntry> {
    let transaction: SDKTransaction | null;
    let signatureAudit: SignatureAudit | null;
    try {
      transaction = SDKTransaction.fromBytes(hexToUint8Array(item.transactionBytes));
      signatureAudit = await computeSignatureKey(
        transaction,
        mirrorNetwork,
        accountInfoCache,
        nodeInfoCache,
        null,
      );
    } catch {
      transaction = null;
      signatureAudit = null;
    }
    return new TransactionBrowserEntry(item, transaction, signatureAudit, userKeys);
  }

  public static async makeFromArray(
    items: ITransactionBrowserItem[],
    mirrorNetwork: string,
    accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
    userKeys: string[],
  ): Promise<TransactionBrowserEntry[]> {
    const result: TransactionBrowserEntry[] = [];
    for (const i of items) {
      result.push(await this.make(i, mirrorNetwork, accountInfoCache, nodeInfoCache, userKeys));
    }
    return result;
  }
}
