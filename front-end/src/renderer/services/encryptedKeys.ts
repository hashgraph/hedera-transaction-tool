import { commonIPCHandler } from '@renderer/utils';

/* Searches for encrypted keys in the provided files */
export const searchEncryptedKeys = async (filePaths: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.encryptedKeys.searchEncryptedKeys(filePaths);
  }, 'Search for encrypted keys failed');

/* Aborts the file search */
export const abortFileSearch = () => {
  window.electronAPI.local.encryptedKeys.searchEncryptedKeysAbort();
};

/* Decrypts the encrypted key */
export const decryptEncryptedKey = async (filePath: string, password: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.encryptedKeys.decryptEncryptedKey(filePath, password);
  }, 'Decrypting encrypted key failed');
