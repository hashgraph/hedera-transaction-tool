import { ipcMain } from 'electron';
import { Transaction } from '@prisma/client';

import {
  executeQuery,
  executeTransaction,
  getTransactions,
  storeTransaction,
  encodeSpecialFile,
} from '@main/services/localUser';

const createChannelName = (...props) => ['transactions', ...props].join(':');

export default () => {
  /* Transactions */

  // Execute transaction
  ipcMain.handle(
    createChannelName('executeTransaction'),
    (
      _e,
      transactionBytes: string,
      networkName: 'mainnet' | 'testnet' | 'previewnet' | 'custom',
      network: {
        [key: string]: string;
      },
      mirrorNetwork: string,
    ) => executeTransaction(transactionBytes, networkName, network, mirrorNetwork),
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

  // Encode special file
  ipcMain.handle(
    createChannelName('encodeSpecialFile'),
    (_e, content: Uint8Array, fileId: string) => encodeSpecialFile(content, fileId),
  );
};
