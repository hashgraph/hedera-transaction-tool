import { ipcMain } from 'electron';
import {
  storeKeyPair,
  deleteSecretHashes,
  changeDecryptionPassword,
  getStoredKeyPairs,
  getStoredKeysSecretHashes,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
} from '../../../services/localUser';
import { IKeyPair } from '../../../shared/interfaces';

const createChannelName = (...props) => ['keyPairs', ...props].join(':');

export default () => {
  // Store key pair
  ipcMain.handle(
    createChannelName('store'),
    async (
      _e,
      email: string,
      password: string,
      keyPair: IKeyPair,
      secretHash?: string,
      serverUrl?: string,
      userId?: string,
    ) => {
      await storeKeyPair(email, password, keyPair, secretHash, serverUrl, userId);
    },
  );

  // Change Decryption Password
  ipcMain.handle(
    createChannelName('changeDecryptionPassword'),
    (_e, email: string, oldPassword: string, newPassword: string) =>
      changeDecryptionPassword(email, oldPassword, newPassword),
  );

  // Decrypted private key
  ipcMain.handle(
    createChannelName('decryptPrivateKey'),
    async (_e, email: string, password: string, publicKey: string) =>
      decryptPrivateKey(email, password, publicKey),
  );

  // Get stored stored key pairs
  ipcMain.handle(
    createChannelName('getStored'),
    async (
      _e,
      email: string,
      serverUrl?: string,
      userId?: string,
      secretHash?: string,
      secretHashName?: string,
    ) => getStoredKeyPairs(email, serverUrl, userId, secretHash, secretHashName),
  );

  // Get stored keys' secret hashes
  ipcMain.handle(
    createChannelName('getStoredKeysSecretHashes'),
    async (_e, email: string, serverUrl?: string, userId?: string) =>
      getStoredKeysSecretHashes(email, serverUrl, userId),
  );

  // Delete encrypted private keys
  ipcMain.handle(
    createChannelName('deleteEncryptedPrivateKeys'),
    async (_e, email: string, serverUrl: string, userId: string) =>
      deleteEncryptedPrivateKeys(email, serverUrl, userId),
  );

  // Clear keys file
  ipcMain.handle(
    createChannelName('clear'),
    async (_e, email: string, serverUrl?: string, userId?: string) => {
      try {
        await deleteSecretHashes(email, serverUrl, userId);
        return true;
      } catch {
        return false;
      }
    },
  );
};
