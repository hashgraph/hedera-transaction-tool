import { ipcMain } from 'electron';

import { getAssociatedAccounts } from '@main/services/localUser';

const createChannelName = (...props) => ['associatedAccounts', ...props].join(':');

export default () => {
  /* Associated Accounts */

  // Get associated accounts
  ipcMain.handle(createChannelName('getAssociatedAccounts'), (_e, contactId: string) =>
    getAssociatedAccounts(contactId),
  );
};
