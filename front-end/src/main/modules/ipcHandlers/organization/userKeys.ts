import { ipcMain } from 'electron';

import { getOwn, upload, deleteKey } from '@main/services/organization';

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

  /* Delete key from organization */
  ipcMain.handle(
    createChannelName('deleteKey'),
    async (_e, organizationId: string, userId: string, keyId: number) =>
      deleteKey(organizationId, userId, keyId),
  );
};
