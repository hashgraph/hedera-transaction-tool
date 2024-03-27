import { ipcMain } from 'electron';

import { getOwn } from '@main/services/organization';

const createChannelName = (...props) => ['remote', 'userKeys', ...props].join(':');

export default () => {
  /* User Keys */

  /* Get user keys from organization */
  ipcMain.handle(createChannelName('getOwn'), (_e, organizationId: string, userId: string) =>
    getOwn(organizationId, userId),
  );
};
