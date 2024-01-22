import { ipcMain } from 'electron';

import { executeQuery, executeTransaction } from '../../../services/localUser';

const createChannelName = (...props) => ['transactions', ...props].join(':');

export default () => {
  // Execute transaction
  ipcMain.handle(createChannelName('executeTransaction'), (_e, transactionData: string) =>
    executeTransaction(transactionData),
  );

  // Execute query
  ipcMain.handle(createChannelName('executeQuery'), (_e, queryData: string) =>
    executeQuery(queryData),
  );
};
