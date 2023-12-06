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
  ipcMain.handle(createChannelName('store'), async (e, password: string, keyPair: IKeyPair) => {
    await storeKeyPair(getKeyPairsFilePath(app), password, keyPair);
  });

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStored'), async () =>
    getStoredKeyPairs(getKeyPairsFilePath(app)),
  );

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('clear'), async () => {
    try {
      await clearKeys(getKeyPairsFilePath(app));
      return true;
    } catch {
      console.log('no such folder');
    }
  });
};
