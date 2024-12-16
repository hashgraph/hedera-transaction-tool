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
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Transactions */
  createIPCChannel('transactions', [
    renameFunc(setClient, 'setClient'),
    renameFunc(freezeTransaction, 'freezeTransaction'),
    renameFunc(signTransaction, 'signTransaction'),
    renameFunc(executeTransaction, 'executeTransaction'),
    renameFunc(executeQuery, 'executeQuery'),
    renameFunc(storeTransaction, 'storeTransaction'),
    renameFunc(getTransactions, 'getTransactions'),
    renameFunc(getTransaction, 'getTransaction'),
    renameFunc(getTransactionsCount, 'getTransactionsCount'),
    renameFunc(encodeSpecialFile, 'encodeSpecialFile'),
  ]);
};
