import { ipcMain } from 'electron';

import {
  getFileStreamEventEmitter,
  searchEncryptedKeysAbort,
  EncryptedKeysSearcher,
  Abortable,
  decryptPrivateKeyFromPath,
} from '@main/services/localUser';

const createChannelName = (...props) => ['encryptedKeys', ...props].join(':');

export default () => {
  // Searches for encrypted keys in the given file paths
  ipcMain.handle(createChannelName('searchEncryptedKeys'), async (_e, filePaths: string[]) => {
    const encryptedFilesExtension = ['.pem'];

    const abortable = new Abortable(searchEncryptedKeysAbort);
    const searcher = new EncryptedKeysSearcher(abortable, encryptedFilesExtension);

    return await searcher.search(filePaths);
  });

  // Aborts the search for encrypted keys
  ipcMain.on(createChannelName('searchEncryptedKeys:abort'), () => {
    getFileStreamEventEmitter().emit(searchEncryptedKeysAbort);
  });

  // Decrypts the encrypted key in the given file path
  ipcMain.handle(
    createChannelName('decryptEncryptedKey'),
    async (
      _e,
      filePath: string,
      password: string,
      skipIndexes: number[] | null,
      skipHashCode: number | null,
    ) => {
      return await decryptPrivateKeyFromPath(filePath, password, skipIndexes, skipHashCode);
    },
  );
};
