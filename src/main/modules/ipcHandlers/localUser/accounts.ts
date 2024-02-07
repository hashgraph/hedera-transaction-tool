import { ipcMain } from 'electron';

import { addAccount, getAccounts, removeAccount } from '../../../services/localUser';

const createChannelName = (...props) => ['accounts', ...props].join(':');

export default () => {
  /* Accounts */

  // Get all
  ipcMain.handle(createChannelName('getAll'), (_e, userId: string) => getAccounts(userId));

  // Add
  ipcMain.handle(
    createChannelName('add'),
    (_e, userId: string, accountId: string, nickname: string = '') =>
      addAccount(userId, accountId, nickname),
  );

  // Remove
  ipcMain.handle(
    createChannelName('remove'),
    (_e, userId: string, accountId: string, nickname: string = '') =>
      removeAccount(userId, accountId, nickname),
  );
};
