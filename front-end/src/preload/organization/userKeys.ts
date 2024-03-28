import { ipcRenderer } from 'electron';

import { IUserKey } from '@main/shared/interfaces';

const createChannelName = (...props) => ['remote', 'userKeys', ...props].join(':');

export default {
  userKeys: {
    getOwn: (organizationId: string, userId: string): Promise<IUserKey[]> =>
      ipcRenderer.invoke(createChannelName('getOwn'), organizationId, userId),
    upload: (
      organizationId: string,
      userId: string,
      key: { publicKey: string; index?: number; mnemonicHash?: string },
    ): Promise<void> =>
      ipcRenderer.invoke(createChannelName('upload'), organizationId, userId, key),
    deleteKey: (organizationId: string, userId: string, keyId: number): Promise<void> =>
      ipcRenderer.invoke(createChannelName('deleteKey'), organizationId, userId, keyId),
  },
};
