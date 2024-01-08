import { ipcMain } from 'electron';
import {
  storeKeyPair,
  deleteSecretHashesFile,
  changeDecryptionPassword,
  getKeyPairsFilePath,
  getStoredKeyPairs,
  getStoredKeysSecretHashes,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
} from '../../services/keyPairs';
import { IKeyPair } from '../../shared/interfaces';

const createChannelName = (...props) => ['keyPairs', ...props].join(':');

export default (app: Electron.App) => {
  // Generate key pair
  ipcMain.handle(
    createChannelName('store'),
    async (_e, userId: string, password: string, secretHash: string, keyPair: IKeyPair) => {
      await storeKeyPair(getKeyPairsFilePath(app, userId), password, secretHash, keyPair);
    },
  );

  // Change Decryption Password
  ipcMain.handle(
    createChannelName('changeDecryptionPassword'),
    (_e, userId: string, oldPassword: string, newPassword: string) =>
      changeDecryptionPassword(getKeyPairsFilePath(app, userId), oldPassword, newPassword),
  );

  // Decrypted private key
  ipcMain.handle(
    createChannelName('decryptPrivateKey'),
    async (_e, userId: string, password: string, publicKey: string) =>
      decryptPrivateKey(getKeyPairsFilePath(app, userId), password, publicKey),
  );

  // Decrypt stored key pairs
  ipcMain.handle(
    createChannelName('getStored'),
    async (_e, userId: string, secretHash?: string, secretHashName?: string) =>
      getStoredKeyPairs(getKeyPairsFilePath(app, userId), secretHash, secretHashName),
  );

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStoredKeysSecretHashes'), async (_e, userId: string) =>
    getStoredKeysSecretHashes(getKeyPairsFilePath(app, userId)),
  );

  // Delete encrypted private keys
  ipcMain.handle(createChannelName('deleteEncryptedPrivateKeys'), async (_e, userId: string) =>
    deleteEncryptedPrivateKeys(getKeyPairsFilePath(app, userId)),
  );

  // Clear keys file
  ipcMain.handle(createChannelName('clear'), async (_e, userId: string) => {
    try {
      await deleteSecretHashesFile(getKeyPairsFilePath(app, userId));
      return true;
    } catch {
      console.log('no such folder');
      return false;
    }
  });
};
