import { Key, KeyList, PublicKey, Transaction } from '@hashgraph/sdk';

import { IUserKey } from '@main/shared/interfaces';

import { hexToUint8Array } from '@renderer/services/electronUtilsService';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';

import { isExpired, isPublicKeyInKeyList } from '../sdk';

import TransactionFactory from './transaction-factory';

export * from './account-create-transaction.model';
export * from './account-update-transaction.model';
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

/* Returns wheter a user should sign the transaction */
export const shouldSignTransaction = async (
  body: string,
  userKeys: IUserKey[],
  mirrorNodeLink: string,
): Promise<boolean> => {
  /* Ensures the user keys are passed */
  if (userKeys.length === 0) return false;

  const bodyBytesString = await hexToUint8Array(body);
  const bodyBytes = Uint8Array.from(bodyBytesString.split(',').map(b => Number(b)));

  /* Deserialize the transaction */
  const sdkTransaction = Transaction.fromBytes(bodyBytes);

  /* Ignore if expired */
  if (isExpired(sdkTransaction)) return false;

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts } = getSignatureEntities(sdkTransaction);

  /* Check if the user has a key that is required to sign */
  const userKeysIncludedInTransaction = userKeys.filter(userKey =>
    newKeys.some(key =>
      isPublicKeyInKeyList(userKey.publicKey, key instanceof KeyList ? key : new KeyList([key])),
    ),
  );
  if (userKeysIncludedInTransaction.length > 0) return true;

  const someUserKeyInOrIsKey = (key: Key) =>
    (key instanceof PublicKey &&
      userKeys.some(userKey => userKey.publicKey === key.toStringRaw())) ||
    (key instanceof KeyList &&
      userKeys.some(userKey => isPublicKeyInKeyList(userKey.publicKey, key)));

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.key) continue;

    if (someUserKeyInOrIsKey(accountInfo.key)) return true;
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.receiverSignatureRequired) continue;

    if (!accountInfo.key) continue;

    if (someUserKeyInOrIsKey(accountInfo.key)) return true;
  }

  return false;
};
