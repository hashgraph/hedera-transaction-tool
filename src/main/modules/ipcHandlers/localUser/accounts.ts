import { ipcMain } from 'electron';

import { addAccount, getAccounts, removeAccount } from '../../../services/localUser/accounts';

const createChannelName = (...props) => ['accounts', ...props].join(':');

export default () => {
  /* Accounts */

  // Get all
  ipcMain.handle(createChannelName('getAll'), (_e, email: string) => getAccounts(email));

  // Add
  ipcMain.handle(
    createChannelName('add'),
    (_e, email: string, accountId: string, nickname: string = '') =>
      addAccount(email, accountId, nickname),
  );

  // Remove
  ipcMain.handle(
    createChannelName('remove'),
    (_e, email: string, accountId: string, nickname: string = '') =>
      removeAccount(email, accountId, nickname),
  );
};
