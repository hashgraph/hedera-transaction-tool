import { ipcMain } from 'electron';

import { executeQuery, executeTransaction } from '../../../services/localUser';

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

  // // Stores a transaction
  // ipcMain.handle(
  //   createChannelName('saveTransaction'),
  //   (_e, email: string, transaction: IStoredTransaction) => saveTransaction(email, transaction),
  // );

  // // Get stored transactions
  // ipcMain.handle(createChannelName('getTransactions'), (_e, email: string, serverUrl?: string) =>
  //   getTransactions(email, serverUrl),
  // );
};
