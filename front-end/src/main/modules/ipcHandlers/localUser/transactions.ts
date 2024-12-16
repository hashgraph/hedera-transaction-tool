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
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Transactions */
  createIPCChannel('transactions', [
    setClient,
    freezeTransaction,
    signTransaction,
    executeTransaction,
    executeQuery,
    storeTransaction,
    getTransactions,
    getTransaction,
    getTransactionsCount,
    encodeSpecialFile,
  ]);
};
