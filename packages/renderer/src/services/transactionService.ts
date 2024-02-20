import type {Transaction} from '@hashgraph/sdk';
import {AccountId, PrivateKey, PublicKey, Timestamp, TransactionId} from '@hashgraph/sdk';

import type {KeyPair, Transaction as Tx} from '@prisma/client';

import type {CustomNetworkSettings, Network} from '@renderer/stores/storeNetwork';

import {getMessageFromIPCError} from '@renderer/utils';

import {decryptPrivateKey} from './keyPairService';

/* Transaction service */

/* Sets the client in the main processor */
export const setClient = async (
  network: string,
  nodeAccountIds?: {
    [key: string]: string;
  },
  mirrorNetwork?: string[],
) => {
  if (nodeAccountIds) {
    Object.keys(nodeAccountIds).forEach(key => {
      nodeAccountIds[key] = nodeAccountIds[key].toString();
    });
  }

  await window.electronAPI.transactions.setClient(network, nodeAccountIds, mirrorNetwork);
};

/* Crafts transaction id by account id and valid start */
export const createTransactionId = (
  accountId: AccountId | string,
  validStart: Timestamp | string | Date | null,
) => {
  if (typeof accountId === 'string') {
    accountId = AccountId.fromString(accountId);
  }

  if (!validStart) {
    validStart = Timestamp.generate();
  }

  if (typeof validStart === 'string' || validStart instanceof Date) {
    validStart = Timestamp.fromDate(validStart);
  }

  return TransactionId.withValidStart(accountId, validStart);
};

/* Collects and adds the signatures for the provided key pairs */
export const getTransactionSignatures = async (
  keyPairs: KeyPair[],
  transaction: Transaction,
  userId: string,
  password: string,
) => {
  const publicKeys: string[] = [];

  try {
    await Promise.all(
      keyPairs.map(async keyPair => {
        if (!publicKeys.includes(keyPair.public_key)) {
          const privateKeyString = await decryptPrivateKey(userId, password, keyPair.public_key);
          const startsWithHex = privateKeyString.startsWith('0x');

          const keyType = PublicKey.fromString(keyPair.public_key);

          const privateKey =
            keyType._key._type === 'secp256k1'
              ? PrivateKey.fromStringECDSA(`${startsWithHex ? '' : '0x'}${privateKeyString}`)
              : PrivateKey.fromStringED25519(privateKeyString);

          transaction.sign(privateKey);

          publicKeys.push(keyPair.public_key);
        }
      }),
    );

    return publicKeys;
  } catch (err: any) {
    throw Error(err.message || 'Failed to collect transaction signatures');
  }
};

/* Freezes the transaction in the main process */
export const freeze = async (transactionBytes: Uint8Array) => {
  try {
    return await window.electronAPI.transactions.freezeTransaction(transactionBytes);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Freezing the transaction failed'));
  }
};

/* Signs the transaction in the main process */
export const signTransaction = async (
  transactionBytes: Uint8Array,
  publicKeys: string[],
  userId: string,
  userPassword: string,
) => {
  try {
    return await window.electronAPI.transactions.signTransaction(
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Transaction signing failed'));
  }
};

/* Executes the transaction in the main process */
export const execute = async (transactionBytes: Uint8Array) => {
  try {
    return await window.electronAPI.transactions.executeTransaction(transactionBytes);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Transaction Failed'));
  }
};

/* Executes the query in the main process */
export const executeQuery = async (
  queryBytes: string,
  network: Network,
  customNetworkSettings: CustomNetworkSettings | null,
  accountId: string,
  privateKey: string,
  type: string,
) => {
  try {
    return await window.electronAPI.transactions.executeQuery(
      JSON.stringify({queryBytes, network, customNetworkSettings, accountId, privateKey, type}),
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Query Execution Failed'));
  }
};

/* Saves transaction info */
export const storeTransaction = async (transaction: Tx) => {
  try {
    return await window.electronAPI.transactions.storeTransaction(transaction);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Saving transaction Failed'));
  }
};

/* Returns saved transactions */
export const getTransactions = async (user_id: string) => {
  try {
    return await window.electronAPI.transactions.getTransactions(user_id);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Getting transactions Failed'));
  }
};

/* Encodes a special file's content */
export const encodeSpecialFileContent = async (content: Uint8Array, fileId: string) => {
  try {
    return await window.electronAPI.transactions.encodeSpecialFile(content, fileId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to encode special file'));
  }
};
