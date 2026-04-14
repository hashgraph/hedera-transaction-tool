import { type ITransaction, type IUserKey, TransactionStatus } from '@shared/interfaces';

import { Transaction as SDKTransaction } from '@hiero-ledger/sdk';
import { flattenKeyList } from '../../services/keyPairService';
import type { ConnectedOrganization, LoggedInOrganization } from '@renderer/types';
import { hexToUint8Array } from '@renderer/utils';
import type { AppCache } from '@renderer/caches/AppCache';

export * from './account-create-transaction.model';
export * from './account-update-transaction.model';
export * from './account-delete-transaction.model';
export * from './approve-allowance-transaction.model';
export * from './file-create-transaction.model';
export * from './file-append-transaction.model';
export * from './file-update-transaction.model';
export * from './freeze-transaction.model';
export * from './system-delete-transaction.model';
export * from './transaction-factory';
export * from './transaction.model';
export * from './transfer-transaction.model';

export const COUNCIL_ACCOUNTS = ['0.0.2', '0.0.50', '0.0.55'];

/* Returns only users PK required to sign */
export const usersPublicRequiredToSign = async (
  transaction: SDKTransaction,
  userKeys: IUserKey[],
  mirrorNodeLink: string,
  appCache: AppCache,
  organization: ConnectedOrganization | null,
): Promise<string[]> => {
  const publicKeysRequired: Set<string> = new Set<string>();

  /* Ensures the user keys are passed */
  if (userKeys.length === 0) return [];

  /* Transaction signers' public keys */
  const signerPublicKeys = new Set([...transaction._signerPublicKeys]);

  const requiredKeys = await appCache.computeSignatureKey(
    transaction,
    organization,
    mirrorNodeLink,
  );

  const requiredUnsignedKeys = new Set<string>();
  requiredKeys.signatureKeys.forEach(key => {
    flattenKeyList(key).forEach(flatKey => {
      const rawKey = flatKey.toStringRaw();
      if (!signerPublicKeys.has(rawKey)) {
        requiredUnsignedKeys.add(rawKey);
      }
    });
  });

  userKeys.forEach(userKey => {
    if (requiredUnsignedKeys.has(userKey.publicKey)) {
      publicKeysRequired.add(userKey.publicKey);
    }
  });

  return [...publicKeysRequired];
};

export const isSignableTransaction = async (
  tx: ITransaction,
  mirrorNodeLink: string,
  appCache: AppCache,
  organization: ConnectedOrganization & LoggedInOrganization,
): Promise<boolean> => {
  let result: boolean;
  if (tx.status === TransactionStatus.WAITING_FOR_SIGNATURES) {
    const transactionBytes = hexToUint8Array(tx.transactionBytes);
    try {
      const sdkTransaction = SDKTransaction.fromBytes(transactionBytes);
      const usersPublicKeys = await usersPublicRequiredToSign(
        sdkTransaction,
        organization.userKeys,
        mirrorNodeLink,
        appCache,
        organization,
      );
      result = usersPublicKeys.length > 0;
    } catch {
      result = false;
    }
  } else {
    result = false;
  }
  return result;
};
