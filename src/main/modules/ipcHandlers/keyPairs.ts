import { ipcMain } from 'electron';
import {
  storeKeyPair,
  clearKeys,
  changeDecryptionPassword,
  getKeyPairsFilePath,
  getStoredKeyPairs,
  decryptPrivateKey,
} from '../../services/keyPairs';
import { IKeyPair } from '../../shared/interfaces/IKeyPair';

const createChannelName = (...props) => ['keyPairs', ...props].join(':');

export default (app: Electron.App) => {
  // Generate key pair
  ipcMain.handle(
    createChannelName('store'),
    async (e, userId: string, password: string, secretHash: string, keyPair: IKeyPair) => {
      await storeKeyPair(getKeyPairsFilePath(app, userId), password, secretHash, keyPair);
    },
  );

  // Change Decryption Password
  ipcMain.handle(
    createChannelName('changeDecryptionPassword'),
    (e, userId: string, oldPassword: string, newPassword: string) =>
      changeDecryptionPassword(getKeyPairsFilePath(app, userId), oldPassword, newPassword),
  );

  // Decrypted private key
  ipcMain.handle(
    createChannelName('decryptPrivateKey'),
    async (e, userId: string, password: string, publicKey: string) =>
      decryptPrivateKey(getKeyPairsFilePath(app, userId), password, publicKey),
  );

  // Decrypt stored key pairs
  ipcMain.handle(
    createChannelName('getStored'),
    async (e, userId: string, secretHash?: string, secretHashName?: string) =>
      getStoredKeyPairs(getKeyPairsFilePath(app, userId), secretHash, secretHashName),
  );

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('clear'), async (e, userId: string) => {
    try {
      await clearKeys(getKeyPairsFilePath(app, userId));
      return true;
    } catch {
      console.log('no such folder');
    }
  });
};
