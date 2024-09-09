import { ipcMain } from 'electron';

import { searchEncryptedKeys } from '@main/services/localUser';

const createChannelName = (...props) => ['encryptedKeys', ...props].join(':');

export default () => {
  // Searches for encrypted keys in the given file paths
  ipcMain.handle(createChannelName('searchEncryptedKeys'), (_e, filePaths: string[]) =>
    searchEncryptedKeys(filePaths),
  );
};
