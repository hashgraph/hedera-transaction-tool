import {
  decryptPrivateKeyFromPath,
  searchEncryptedKeys,
  abortEncryptedKeySearch,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  createIPCChannel('encryptedKeys', [
    renameFunc(decryptPrivateKeyFromPath, 'decryptEncryptedKey'),
    renameFunc(searchEncryptedKeys, 'searchEncryptedKeys'),
    renameFunc(abortEncryptedKeySearch, 'searchEncryptedKeys:abort'),
  ]);
};
