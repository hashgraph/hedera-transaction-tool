import { ipcRenderer } from 'electron';

export default {
  encryptedKeys: {
    searchEncryptedKeys: (filePaths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('encryptedKeys:searchEncryptedKeys', filePaths),
    searchEncryptedKeysAbort: () => ipcRenderer.send('encryptedKeys:searchEncryptedKeys:abort'),
    decryptEncryptedKey: (
      filePath: string,
      password: string,
    ): Promise<{
      privateKey: string;
      recoveryPhraseHashCode: number | null;
      index: number | null;
    }> => ipcRenderer.invoke('encryptedKeys:decryptEncryptedKey', filePath, password),
  },
};
