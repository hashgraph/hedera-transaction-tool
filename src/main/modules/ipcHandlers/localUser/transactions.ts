import { ipcMain } from 'electron';
import { Transaction } from '@prisma/client';

import {
  executeQuery,
  executeTransaction,
  getTransactions,
  storeTransaction,
} from '../../../services/localUser';

const createChannelName = (...props) => ['transactions', ...props].join(':');

export default () => {
  /* Transactions */

  // Execute transaction
  ipcMain.handle(createChannelName('executeTransaction'), (_e, transactionData: string) =>
    executeTransaction(transactionData),
  );

  // Execute query
  ipcMain.handle(createChannelName('executeQuery'), (_e, queryData: string) =>
    executeQuery(queryData),
  );

  // Stores a transaction
  ipcMain.handle(createChannelName('storeTransaction'), (_e, transaction: Transaction) =>
    storeTransaction(transaction),
  );

  // Get stored transactions
  ipcMain.handle(createChannelName('getTransactions'), (_e, user_id: string) =>
    getTransactions(user_id),
  );
};
