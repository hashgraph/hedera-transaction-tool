import { ipcMain } from 'electron';
import {
  storeKeyPair,
  clearKeys,
  getKeyPairsFilePath,
  getStoredKeyPairs,
} from '../../services/keyPairs';
import { IKeyPair } from '../../shared/interfaces/IKeyPair';

const createChannelName = (...props) => ['privateKey', ...props].join(':');

export default (app: Electron.App) => {
  // Generate key pair
  ipcMain.handle(
    createChannelName('store'),
    async (e, userId: string, password: string, keyPair: IKeyPair) => {
      await storeKeyPair(getKeyPairsFilePath(app, userId), password, keyPair);
    },
  );

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStored'), async (e, userId: string) =>
    getStoredKeyPairs(getKeyPairsFilePath(app, userId)),
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
