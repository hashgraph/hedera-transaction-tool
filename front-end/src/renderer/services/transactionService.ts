import { TransactionReceipt, TransactionResponse, } from '@hiero-ledger/sdk';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

/* Transaction service */

/* Sets the client in the main processor */
export const setClient = async (mirrorNetwork: string | string[], ledgerId?: string) =>
  commonIPCHandler(async () => {
    await window.electronAPI.local.transactions.setClient(mirrorNetwork, ledgerId);
  }, 'Failed to set client');

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
  needsFreeze = true,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactions.signTransaction(
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
      needsFreeze
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
