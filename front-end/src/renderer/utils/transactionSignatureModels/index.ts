import type { IUserKey } from '@main/shared/interfaces';

import { Key, KeyList, NodeUpdateTransaction, Transaction } from '@hashgraph/sdk';

import { getAccountInfo, getNodeInfo } from '@renderer/services/mirrorNodeDataService';

import { isPublicKeyInKeyList, transactionIs } from '../sdk';

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
      nodeId: transactionModel.getNodeId(),
    };

    return result;
  } catch (error) {
    console.log(error);
    return {
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
      nodeId: null,
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

  /* Transaction signers' public keys */
  const signerPublicKeys = [...transaction._signerPublicKeys];

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts, nodeId } = getSignatureEntities(transaction);

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

  const addUserPublicKeyIfRequired = (key: Key) => {
    const userKeysRequired = userKeys.filter(
      userKey =>
        isPublicKeyInKeyList(userKey.publicKey, key) &&
        !signerPublicKeys.includes(userKey.publicKey),
    );
    userKeysRequired.forEach(userKey => publicKeysRequired.add(userKey.publicKey));
  };

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.key) continue;
    addUserPublicKeyIfRequired(accountInfo.key);
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;
    addUserPublicKeyIfRequired(accountInfo.key);
  }

  /* Check if user has a key included in the node ids */
  const result = await getNodeKeys(nodeId, transaction, mirrorNodeLink);
  if (result.nodeAccountKey && result.adminKey) {
    addUserPublicKeyIfRequired(result.adminKey);
    addUserPublicKeyIfRequired(result.nodeAccountKey);
  }

  return [...publicKeysRequired];
};

/* Computes the signature key for the transaction */
export const computeSignatureKey = async (transaction: Transaction, mirrorNodeLink: string) => {
  /* Get the accounts, receiver accounts and new keys from the transaction */
  const { accounts, receiverAccounts, newKeys, nodeId } = getSignatureEntities(transaction);

  /* Create result object */
  const resultObject: {
    signatureKey: KeyList;
    accountsKeys: {
      [accountId: string]: Key;
    };
    receiverAccountsKeys: {
      [accountId: string]: Key;
    };
    newKeys: Key[];
    payerKey: {
      [accountId: string]: Key;
    };
    nodeAdminKeys: {
      [nodeId: string]: Key;
    };
  } = {
    signatureKey: new KeyList(),
    accountsKeys: {},
    receiverAccountsKeys: {},
    payerKey: {},
    nodeAdminKeys: {},
    newKeys,
  };

  /* Add keys to the signature key list */
  newKeys.forEach(key => resultObject.signatureKey.push(key));

  /* Add the keys of the account ids to the signature key list */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.key) continue;

    resultObject.signatureKey.push(accountInfo.key);

    if (transaction.transactionId?.accountId?.toString() === accountId) {
      resultObject.payerKey[accountId] = accountInfo.key;
    } else {
      resultObject.accountsKeys[accountId] = accountInfo.key;
    }
  }

  /* Check if there is a receiver account that required signature, if so add it to the key list */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;

    resultObject.signatureKey.push(accountInfo.key);
    resultObject.receiverAccountsKeys[accountId] = accountInfo.key;
  }

  /* Check if user has a key included in the node ids */
  const result = await getNodeKeys(nodeId, transaction, mirrorNodeLink);
  if (nodeId && result.nodeAccountId && result.nodeAccountKey && result.adminKey) {
    resultObject.signatureKey.push(result.adminKey);
    resultObject.nodeAdminKeys[nodeId] = result.adminKey;
    resultObject.signatureKey.push(result.nodeAccountKey);
    resultObject.accountsKeys[result.nodeAccountId] = result.nodeAccountKey;
  }

  return resultObject;
};

/***
  Helper functions
***/

const getNodeKeys = async (
  nodeId: number | null,
  transaction: Transaction,
  mirrorNodeLink: string,
) => {
  let adminKey: Key | null = null;
  let nodeAccountKey: Key | null = null;
  let nodeAccountId: string | null = null;

  if (nodeId) {
    const nodeInfo = await getNodeInfo(nodeId, mirrorNodeLink);
    if (nodeInfo?.admin_key) {
      adminKey = nodeInfo.admin_key;
    }

    if (transactionIs(NodeUpdateTransaction, transaction)) {
      nodeAccountId = nodeInfo?.node_account_id?.toString() || null;
      if (transaction.accountId && nodeAccountId) {
        const accountInfo = await getAccountInfo(nodeAccountId, mirrorNodeLink);
        if (accountInfo?.key) {
          nodeAccountKey = accountInfo.key;
        }
      }
    }
  }

  return { adminKey, nodeAccountKey, nodeAccountId };
};
