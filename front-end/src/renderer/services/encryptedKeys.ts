import { commonIPCHandler } from '@renderer/utils';

export const searchEncryptedKeys = async (filePaths: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.encryptedKeys.searchEncryptedKeys(filePaths);
  }, 'Search for encrypted keys failed');

/* Aborts the file search */
export const abortFileSearch = () => {
  window.electronAPI.local.encryptedKeys.searchEncryptedKeysAbort();
};
