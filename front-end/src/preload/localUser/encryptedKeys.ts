import { ipcRenderer } from 'electron';

export default {
  encryptedKeys: {
    searchEncryptedKeys: (filePaths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('encryptedKeys:searchEncryptedKeys', filePaths),
    searchEncryptedKeysAbort: () => ipcRenderer.send('encryptedKeys:searchEncryptedKeys:abort'),
    decryptEncryptedKey: (filePath: string, password: string): Promise<string> =>
      ipcRenderer.invoke('encryptedKeys:decryptEncryptedKey', filePath, password),
  },
};
