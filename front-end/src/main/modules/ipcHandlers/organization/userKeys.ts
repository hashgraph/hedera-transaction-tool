import { ipcMain } from 'electron';

import { getOwn, upload } from '@main/services/organization';

const createChannelName = (...props) => ['remote', 'userKeys', ...props].join(':');

export default () => {
  /* User Keys */

  /* Get user keys from organization */
  ipcMain.handle(createChannelName('getOwn'), (_e, organizationId: string, userId: string) =>
    getOwn(organizationId, userId),
  );

  /* Uploads a key to the organization */
  ipcMain.handle(
    createChannelName('upload'),
    async (
      _e,
      organizationId: string,
      userId: string,
      key: { mnemonicHash: string; index?: number; publicKey?: string },
    ) => upload(organizationId, userId, key),
  );
};
