import type { KeyPair } from '@prisma/client';

import {
  AccountId,
  PrivateKey,
  PublicKey,
  Timestamp,
  Transaction,
  TransactionId,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

import { decryptPrivateKey } from './keyPairService';

/* Transaction service */

/* Sets the client in the main processor */
export const setClient = async (
  network: string,
  nodeAccountIds?: {
    [key: string]: string;
  },
  mirrorNetwork?: string[],
) =>
  commonIPCHandler(async () => {
    if (nodeAccountIds) {
      Object.keys(nodeAccountIds).forEach(key => {
        nodeAccountIds[key] = nodeAccountIds[key].toString();
      });
    }

    await window.electronAPI.local.transactions.setClient(network, nodeAccountIds, mirrorNetwork);
  }, 'Failed to set client');

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
    const date = validStart instanceof Date ? validStart : new Date(validStart);
    const expirationDate = new Date(date.getTime() + 1000 * 60 * 3);
    validStart = Timestamp.fromDate(expirationDate < new Date() ? new Date() : date);
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

  await commonIPCHandler(async () => {
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
  }, 'Failed to collect transaction signatures');
  return publicKeys;
};

/* Freezes the transaction in the main process */
export const freeze = async (transactionBytes: Uint8Array) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.freezeTransaction(transactionBytes);
  }, 'Freezing the transaction failed');

/* Signs the transaction in the main process */
export const signTransaction = async (
  transactionBytes: Uint8Array,
  publicKeys: string[],
  userId: string,
  userPassword: string | null,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.signTransaction(
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
    );
  }, 'Transaction signing failed');

/* Executes the transaction in the main process */
export const execute = async (transactionBytes: Uint8Array) =>
  commonIPCHandler(async () => {
    const executionResult =
      await window.electronAPI.local.transactions.executeTransaction(transactionBytes);

    return {
      response: TransactionResponse.fromJSON(JSON.parse(executionResult.responseJSON)),
      receipt: TransactionReceipt.fromBytes(executionResult.receiptBytes),
    };
  }, 'Transaction Failed');

/* Executes the query in the main process */
export const executeQuery = async (
  queryBytes: Uint8Array,
  accountId: string,
  privateKey: string,
  privateKeyType: string,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.executeQuery(
      queryBytes,
      accountId,
      privateKey,
      privateKeyType,
    );
  }, 'Query Execution Failed');

/* Saves transaction info */
export const storeTransaction = async (transaction: Prisma.TransactionUncheckedCreateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.storeTransaction(transaction);
  }, 'Saving transaction Failed');

/* Returns saved transactions */
export const getTransactions = async (findArgs: Prisma.TransactionFindManyArgs) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.getTransactions(findArgs);
  }, 'Getting transactions Failed');

/* Returns saved transaction by id */
export const getTransaction = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.getTransaction(id);
  }, `Failed to get transaction with id: ${id}`);

/* Returns saved transactions count */
export const getTransactionsCount = async (userId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.getTransactionsCount(userId);
  }, 'Failed to get transactions count');

/* Encodes a special file's content */
export const encodeSpecialFileContent = async (content: Uint8Array, fileId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.encodeSpecialFile(content, fileId);
  }, 'Failed to encode special file');
