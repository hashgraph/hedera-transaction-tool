import { ipcRenderer } from 'electron';

export default {
  encryptedKeys: {
    searchEncryptedKeys: (filePaths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('encryptedKeys:searchEncryptedKeys', filePaths),
  },
};
