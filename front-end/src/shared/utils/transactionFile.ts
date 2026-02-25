import { Transaction as SDKTransaction } from '@hashgraph/sdk';
import { computeSignatureKey, hexToUint8Array, type SignatureAudit } from '@renderer/utils';
import type { ITransaction, TransactionFileItem } from '@shared/interfaces';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { flattenKeyList } from '@renderer/services/keyPairService.ts';
import { getTransactionById, getTransactionGroupById } from '@renderer/services/organization';
import type { ITransactionNode } from '../../../../shared/src/ITransactionNode.ts';

export async function flattenNodeCollection(
  nodeCollection: ITransactionNode[],
  serverUrl: string,
): Promise<ITransaction[]> {
  const result: ITransaction[] = [];

  for (const node of nodeCollection) {
    if (node.groupId !== undefined) {
      const group = await getTransactionGroupById(serverUrl, node.groupId, false);
      for (const item of group.groupItems) {
        result.push(item.transaction);
      }
    } else {
      if (node.transactionId !== undefined) {
        const transaction = await getTransactionById(serverUrl, node.transactionId);
        result.push(transaction);
      }
    }
  }
  return result;
}

export interface TransactionFileItemsStatus {
  fullySigned: TransactionFileItem[];
  needSigning: TransactionFileItem[];
}

export async function filterTransactionFileItemsToBeSigned(
  transactionFileItems: TransactionFileItem[],
  userPublicKeys: string[],
  mirrorNetwork: string,
  accountInfoCache: AccountByIdCache,
  nodeInfoCache: NodeByIdCache,
): Promise<TransactionFileItemsStatus> {
  const fullySigned: TransactionFileItem[] = [];
  const needSigning: TransactionFileItem[] = [];
  for (const item of transactionFileItems) {
    try {
      const transactionBytes = hexToUint8Array(item.transactionBytes);
      const sdkTransaction = SDKTransaction.fromBytes(transactionBytes);
      const audit = await computeSignatureKey(
        sdkTransaction,
        mirrorNetwork,
        accountInfoCache,
        nodeInfoCache,
        null,
      );
      const requiredKeys = filterAuditByUser(audit, userPublicKeys);
      const signingKeys = filterTransactionSignersByUser(sdkTransaction, userPublicKeys);

      if (requiredKeys.size > 0 ) {
        if (signingKeys.size < requiredKeys.size) {
          needSigning.push(item);
        } else {
          fullySigned.push(item);
        }
      }
    } catch {
      // Silently ignored
    }
  }
  return {
    fullySigned: fullySigned,
    needSigning: needSigning,
  };
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

export function filterAuditByUser(audit: SignatureAudit, userKeys: string[]): Set<string> {
  const result = new Set<string>();
  for (const key of audit.signatureKeys) {
    for (const flatKey of flattenKeyList(key)) {
      const flatKeyRaw = flatKey.toStringRaw();
      if (userKeys.includes(flatKeyRaw)) {
        // flatKey belongs to userKeys and is expected to sign transaction
        result.add(flatKeyRaw);
      }
    }
  }
  return result;
}

export function filterTransactionSignersByUser(
  transaction: SDKTransaction,
  userKeys: string[],
): Set<string> {
  const result = new Set<string>();
  for (const key of transaction._signerPublicKeys) {
    if (userKeys.includes(key)) {
      // key belongs to user and is used for signing the transaction
      result.add(key);
    }
  }
  return result;
}
