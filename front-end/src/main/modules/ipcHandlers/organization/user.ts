import { ipcMain } from 'electron';

import { getUserMe } from '@main/services/organization';

const createChannelName = (...props) => ['remote', 'user', ...props].join(':');

export default () => {
  /* User */

  /* Get user information */
  ipcMain.handle(createChannelName('me'), (_e, organizationId: string, userId: string) =>
    getUserMe(organizationId, userId),
  );
};
