import { ipcMain } from 'electron';

import {
  getFileStreamEventEmitter,
  searchEncryptedKeys,
  searchEncryptedKeysAbort,
  withStreamStatus,
} from '@main/services/localUser';

const createChannelName = (...props) => ['encryptedKeys', ...props].join(':');

export default () => {
  // Searches for encrypted keys in the given file paths
  ipcMain.handle(createChannelName('searchEncryptedKeys'), (_e, filePaths: string[]) =>
    withStreamStatus(searchEncryptedKeys)(filePaths),
  );

  // Aborts the search for encrypted keys
  ipcMain.on(createChannelName('searchEncryptedKeys:abort'), () => {
    getFileStreamEventEmitter().emit(searchEncryptedKeysAbort);
  });
};
