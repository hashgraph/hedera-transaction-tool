import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import {
  executeQuery,
  executeTransaction,
  getTransactions,
  storeTransaction,
  encodeSpecialFile,
  setClient,
  freezeTransaction,
  signTransaction,
  getTransactionsCount,
  getTransaction,
} from '@main/services/localUser';

const createChannelName = (...props) => ['transactions', ...props].join(':');

export default () => {
  /* Transactions */

  // Set client
  ipcMain.handle(
    createChannelName('setClient'),
    (
      _e,
      network: string,
      nodeAccountIds?: {
        [key: string]: string;
      },
      mirrorNetwork?: string[],
    ) => setClient(network, nodeAccountIds, mirrorNetwork),
  );

  // Freezes a transaction
  ipcMain.handle(createChannelName('freezeTransaction'), (_e, transactionBytes: Uint8Array) =>
    freezeTransaction(transactionBytes),
  );

  // Signs a transaction
  ipcMain.handle(
    createChannelName('signTransaction'),
    (
      _e,
      transactionBytes: Uint8Array,
      publicKeys: string[],
      userId: string,
      userPassword: string,
    ) => signTransaction(transactionBytes, publicKeys, userId, userPassword),
  );

  // Executes a transaction
  ipcMain.handle(createChannelName('executeTransaction'), (_e, transactionBytes: Uint8Array) =>
    executeTransaction(transactionBytes),
  );

  // Executes a query
  ipcMain.handle(
    createChannelName('executeQuery'),
    (_e, queryBytes: Uint8Array, accountId: string, privateKey: string, privateKeyType: string) =>
      executeQuery(queryBytes, accountId, privateKey, privateKeyType),
  );

  // Stores a transaction
  ipcMain.handle(
    createChannelName('storeTransaction'),
    (_e, transaction: Prisma.TransactionUncheckedCreateInput) => storeTransaction(transaction),
  );

  // Get stored transactions
  ipcMain.handle(
    createChannelName('getTransactions'),
    (_e, findArgs: Prisma.TransactionFindManyArgs) => getTransactions(findArgs),
  );

  // Get stored transaction by id
  ipcMain.handle(createChannelName('getTransaction'), (_e, id: string) => getTransaction(id));

  // Get transactions count
  ipcMain.handle(createChannelName('getTransactionsCount'), (_e, userId: string) =>
    getTransactionsCount(userId),
  );

  // Encode special file
  ipcMain.handle(
    createChannelName('encodeSpecialFile'),
    (_e, content: Uint8Array, fileId: string) => encodeSpecialFile(content, fileId),
  );
};
