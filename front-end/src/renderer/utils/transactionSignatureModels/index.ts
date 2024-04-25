import { Key, KeyList, PublicKey, Transaction } from '@hashgraph/sdk';

import { IUserKey } from '@main/shared/interfaces';

import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';

import { isExpired, isPublicKeyInKeyList } from '../sdk';

import TransactionFactory from './transaction-factory';

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

/* Gets the keys and potential accounts that are required to sign the transaction */
export const getSignatureEntities = (transaction: Transaction) => {
  try {
    const transactionModel = TransactionFactory.fromTransaction(transaction);

    const result = {
      accounts: [...transactionModel.getSigningAccounts()],
      receiverAccounts: [...transactionModel.getReceiverAccounts()],
      newKeys: [...transactionModel.getNewKeys()],
    };

    return result;
  } catch (err) {
    console.log(err);
    return {
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
    };
  }
};

/* Returns whether a user should sign the transaction */
export const publicRequiredToSign = async (
  transaction: Transaction,
  userKeys: IUserKey[],
  mirrorNodeLink: string,
): Promise<string[]> => {
  const publicKeysRequired: Set<string> = new Set<string>();

  /* Ensures the user keys are passed */
  if (userKeys.length === 0) return [];

  /* Ignore if expired */
  if (isExpired(transaction)) return [];

  /* Transaction signers' public keys */
  const signerPublicKeys = [...transaction._signerPublicKeys];

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts } = getSignatureEntities(transaction);

  /* Check if the user has a key that is required to sign */
  const userKeysIncludedInTransaction = userKeys.filter(userKey =>
    newKeys.some(
      key =>
        isPublicKeyInKeyList(
          userKey.publicKey,
          key instanceof KeyList ? key : new KeyList([key]),
        ) && !signerPublicKeys.includes(userKey.publicKey),
    ),
  );
  userKeysIncludedInTransaction.forEach(userKey => publicKeysRequired.add(userKey.publicKey));

  const userKeyInKeyOrIsKey = (key: Key) =>
    key instanceof PublicKey
      ? userKeys.filter(
          userKey =>
            userKey.publicKey === key.toStringRaw() &&
            !signerPublicKeys.includes(userKey.publicKey),
        )
      : key instanceof KeyList
        ? userKeys.filter(
            userKey =>
              isPublicKeyInKeyList(userKey.publicKey, key) &&
              !signerPublicKeys.includes(userKey.publicKey),
          )
        : [];

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.key) continue;

    userKeyInKeyOrIsKey(accountInfo.key).forEach(userKey =>
      publicKeysRequired.add(userKey.publicKey),
    );
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.receiverSignatureRequired) continue;

    if (!accountInfo.key) continue;

    userKeyInKeyOrIsKey(accountInfo.key).forEach(userKey =>
      publicKeysRequired.add(userKey.publicKey),
    );
  }

  return [...publicKeysRequired];
};

/* Computes the signature key for the transaction */
export const computeSignatureKey = async (transaction: Transaction, mirrorNodeLink: string) => {
  /* Get the accounts, receiver accounts and new keys from the transaction */
  const { accounts, receiverAccounts, newKeys } = getSignatureEntities(transaction);

  /* Create a new key list */
  const sigantureKey = new KeyList();

  /* Add keys to the signature key list */
  newKeys.forEach(key => sigantureKey.push(key));

  /* Add the keys of the account ids to the signature key list */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.key) continue;

    sigantureKey.push(accountInfo.key);
  }

  /* Check if there is a receiver account that required signature, if so add it to the key list */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;

    sigantureKey.push(accountInfo.key);
  }

  return sigantureKey;
};
