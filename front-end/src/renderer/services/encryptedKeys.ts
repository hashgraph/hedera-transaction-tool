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
export const decryptEncryptedKey = async (
  filePath: string,
  password: string,
  skipIndexes: number[] | null,
  skipHashCode: number | null,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.encryptedKeys.decryptEncryptedKey(
      filePath,
      password,
      skipIndexes,
      skipHashCode,
    );
  }, 'Decrypting encrypted key failed');

/* Calculates the hash code of the recovery phrase */
export const calculateRecoveryPhraseHashCode = (words: string[]) => {
  let hashCode = 1;
  for (const word of words) {
    let wordHashCode = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      wordHashCode = (31 * wordHashCode + char) | 0 | 0;
    }
    hashCode = (31 * hashCode + wordHashCode) | 0 | 0;
  }
  return hashCode;
};

export const decryptKeysFromFiles = async (
  filePaths: string[],
  mnemonic: string[] | null,
  password: string,
) => {
  const decryptedKeys: {
    privateKey: string;
    recoveryPhraseHashCode: number | null;
    index: number | null;
  }[] = [];

  const recoveryPhraseHashCode = mnemonic ? calculateRecoveryPhraseHashCode(mnemonic) : null;

  for (const path of filePaths) {
    try {
      const decryptedKey = await decryptEncryptedKey(path, password, null, recoveryPhraseHashCode);
      decryptedKeys.push(decryptedKey);
    } catch (error) {
      console.error(`Failed to decrypt key at path: ${path}`, error);
    }
  }

  return decryptedKeys;
};
