import { ipcMain } from 'electron';

import { getNodeAddressBook } from '@main/services/localUser';

const createChannelName = (...props) => ['sdk', ...props].join(':');

export default () => {
  /* SDK */

  // Get NodeAddressBook protobuf
  ipcMain.handle(createChannelName('getNodeAddressBook'), (_e, mirrorNetwork: string) =>
    getNodeAddressBook(mirrorNetwork),
  );
};
