import type { IUserKey } from '@shared/interfaces';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import TransactionFactory from './transaction-factory';
import { flattenKeyList } from '../../services/keyPairService';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';

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

export const computeSignatureKey = async (
  transaction: SDKTransaction,
  mirrorNodeLink: string,
  accountInfoCache: AccountByIdCache,
) => {
  const transactionModel = TransactionFactory.fromTransaction(transaction);

  return await transactionModel.computeSignatureKey(mirrorNodeLink, accountInfoCache);
};

/* Returns only users PK required to sign */
export const usersPublicRequiredToSign = async (
  transaction: SDKTransaction,
  userKeys: IUserKey[],
  mirrorNodeLink: string,
  accountInfoCache: AccountByIdCache,
): Promise<string[]> => {
  const publicKeysRequired: Set<string> = new Set<string>();

  /* Ensures the user keys are passed */
  if (userKeys.length === 0) return [];

  /* Transaction signers' public keys */
  const signerPublicKeys = new Set([...transaction._signerPublicKeys]);

  const requiredKeys = await computeSignatureKey(transaction, mirrorNodeLink, accountInfoCache);

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
