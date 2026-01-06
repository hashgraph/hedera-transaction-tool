import { Transaction as SDKTransaction } from '@hashgraph/sdk';
import { computeSignatureKey, hexToUint8Array } from '@renderer/utils';
import type { TransactionFileItem } from '@shared/interfaces';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { flattenKeyList } from '@renderer/services/keyPairService.ts';

export async function filterTransactionFileItemsToBeSigned(
  transactionFileItems: TransactionFileItem[],
  userPublicKeys: string[],
  mirrorNetwork: string,
  accountInfoCache: AccountByIdCache,
  nodeInfoCache: NodeByIdCache,
): Promise<TransactionFileItem[]> {
  const result: TransactionFileItem[] = [];
  for (const item of transactionFileItems) {
    try {
      const transactionBytes = hexToUint8Array(item.transactionBytes);
      const sdkTransaction = SDKTransaction.fromBytes(transactionBytes);
      const missingSignerKeys = await collectMissingSignerKeys(
        sdkTransaction,
        userPublicKeys,
        mirrorNetwork,
        accountInfoCache,
        nodeInfoCache,
      );
      if (missingSignerKeys.length > 0) {
        result.push(item);
      }
    } catch {
      // Silently ignored
    }
  }
  return result;
}

export async function collectMissingSignerKeys(
  transaction: SDKTransaction,
  userPublicKeys: string[],
  mirrorNodeLink: string,
  accountInfoCache: AccountByIdCache,
  nodeInfoCache: NodeByIdCache,
): Promise<string[]> {
  const result: string[] = [];

  const audit = await computeSignatureKey(
    transaction,
    mirrorNodeLink,
    accountInfoCache,
    nodeInfoCache,
    null,
  );

  const signatureKeys = transaction._signerPublicKeys;
  console.log(`Content of transaction._signerPublicKeys:`);
  signatureKeys.forEach(key => console.log(`   key: ${key}`));

  for (const key of audit.signatureKeys) {
    for (const flatKey of flattenKeyList(key)) {
      if (!signatureKeys.has(flatKey.toStringRaw())) {
        // flatKey must sign the transaction
        // => checks if flatKey is part of user public keys
        if (userPublicKeys.includes(flatKey.toStringRaw())) {
          // User is able to sign transaction with flatKey
          console.log(`Transaction can be signed with key: ${flatKey.toStringRaw()}`);
          result.push(flatKey.toStringRaw());
        }
      }
    }
  }

  return result;
}
