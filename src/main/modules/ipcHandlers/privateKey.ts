import { ipcMain } from 'electron';
import {
  addPrivateKeyEncrypted,
  getPrivateKeysFilePath,
  getStoredPrivateKeys,
} from '../../services/privateKey';
import { PrivateKey } from '@hashgraph/sdk';

const createChannelName = (...props) => ['privateKey', ...props].join(':');

export default (app: Electron.App) => {
  // Generate key pair
  ipcMain.handle(createChannelName('store'), async (e, privateKey: string, index: number) => {
    await addPrivateKeyEncrypted(
      getPrivateKeysFilePath(app),
      PrivateKey.fromStringED25519(privateKey),
      index,
    );

    return { privateKey: privateKey, index };
  });

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStored'), async () => {
    const storedPrivateKeys = await getStoredPrivateKeys(getPrivateKeysFilePath(app));

    return storedPrivateKeys.map(pk => ({
      privateKey: pk.privateKey.toStringRaw(),
      index: pk.index,
    }));
  });
};
