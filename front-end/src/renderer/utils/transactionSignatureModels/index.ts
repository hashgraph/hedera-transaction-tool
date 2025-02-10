import type { IUserKey } from '@main/shared/interfaces';

import { Key, KeyList, NodeUpdateTransaction, PublicKey, Transaction } from '@hashgraph/sdk';

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

const extractRawPublicKey = (key: Key | null): string => {
  if (!key) return '';
  if (typeof (key as PublicKey).toStringRaw === 'function') {
    return (key as PublicKey).toStringRaw();
  }
  return key.toString();
};

export const isTransactionFullySigned = async (
  transaction: Transaction,
  mirrorNodeLink: string,
): Promise<boolean> => {

  const { newKeys, accounts, receiverAccounts, nodeId } = getSignatureEntities(transaction);
  const allRequiredSigners = new Set<string>();

  newKeys.forEach(key => {
    if (key instanceof KeyList) {
      key._keys.forEach(subKey => allRequiredSigners.add(subKey.toString()));
    } else {
      allRequiredSigners.add(key.toString());
    }
  });

  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (accountInfo.key) {
      allRequiredSigners.add(extractRawPublicKey(accountInfo.key));
    }
  }

  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (accountInfo.receiverSignatureRequired && accountInfo.key) {
      allRequiredSigners.add(accountInfo.key.toString());
    }
  }

  const result = await getNodeKeys(nodeId, transaction, mirrorNodeLink);
  if (result.nodeAccountKey) allRequiredSigners.add(result.nodeAccountKey.toString());
  if (result.adminKey) allRequiredSigners.add(result.adminKey.toString());

  const signedSigners = new Set(Object.keys(transaction.getSignatures()));

  const isFullySigned = [...allRequiredSigners].every(pk => signedSigners.has(pk));

  return isFullySigned;
};

/* Returns whether a user should sign the transaction */
export const publicRequiredToSign = async (
  transaction: Transaction,
  userKeys: IUserKey[],
  mirrorNodeLink: string,
): Promise<{ usersPublicKeys: string[]; nonUserPublicKeys: string[] }> => {
  const usersPublicKeys: Set<string> = new Set();
  const nonUserPublicKeys: Set<string> = new Set();

  /* Ensures the user keys are passed */
  if (userKeys.length === 0) {
    return { usersPublicKeys: [], nonUserPublicKeys: [] };
  }

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts, nodeId } = getSignatureEntities(transaction);

  /* Helper function to classify a key */
  const classifyKey = (key: Key) => {
    if (userKeys.some(userKey => isPublicKeyInKeyList(userKey.publicKey, key))) {
      usersPublicKeys.add(extractRawPublicKey(key));
    } else {
      nonUserPublicKeys.add(extractRawPublicKey(key));
    }
  };

  /* Add all public keys from the transaction itself */
  newKeys.forEach(key => {
    if (key instanceof KeyList) {
      key._keys.forEach(subKey => classifyKey(subKey));
    } else {
      classifyKey(key);
    }
  });

  /* Add required keys from account signers */
  for (const accountId of accounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (accountInfo.key) {
      classifyKey(accountInfo.key);
    }
  }

  /* Add required keys from receiver accounts that require signatures */
  for (const accountId of receiverAccounts) {
    const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
    if (accountInfo.receiverSignatureRequired && accountInfo.key) {
      classifyKey(accountInfo.key);
    }
  }

  /* Add required keys from node accounts */
  const result = await getNodeKeys(nodeId, transaction, mirrorNodeLink);
  if (result.nodeAccountKey) classifyKey(result.nodeAccountKey);
  if (result.adminKey) classifyKey(result.adminKey);

  return {
    usersPublicKeys: [...usersPublicKeys],
    nonUserPublicKeys: [...nonUserPublicKeys],
  };
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
