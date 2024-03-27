import { ipcRenderer } from 'electron';

import { IUserKey } from '@main/shared/interfaces';

const createChannelName = (...props) => ['remote', 'userKeys', ...props].join(':');

export default {
  userKeys: {
    getOwn: (organizationId: string, userId: string): Promise<IUserKey[]> =>
      ipcRenderer.invoke(createChannelName('getOwn'), organizationId, userId),
  },
};
