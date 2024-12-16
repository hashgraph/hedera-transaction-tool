import { ipcMain } from 'electron';

import {
  storeKeyPair,
  deleteSecretHashes,
  changeDecryptionPassword,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
  getKeyPairs,
  getSecretHashes,
  deleteKeyPair,
  updateNickname,
  updateMnemonicHash,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

const createChannelName = (...props) => ['keyPairs', ...props].join(':');

export default () => {
  /* Key Pairs */
  createIPCChannel('keyPairs', [
    renameFunc(storeKeyPair, 'store'),
    renameFunc(getKeyPairs, 'getAll'),
    getSecretHashes,
    changeDecryptionPassword,
    updateNickname,
    updateMnemonicHash,
    deleteEncryptedPrivateKeys,
    deleteKeyPair,
    decryptPrivateKey,
  ]);

  // Clear keys file
  ipcMain.handle(
    createChannelName('clear'),
    async (_e, userId: string, organizationId?: string) => {
      try {
        await deleteSecretHashes(userId, organizationId);
        return true;
      } catch {
        return false;
      }
    },
  );
};
