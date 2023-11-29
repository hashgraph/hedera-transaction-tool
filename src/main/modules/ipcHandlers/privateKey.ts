import { ipcMain } from 'electron';
import { Mnemonic } from '@hashgraph/sdk';
import {
  addPrivateKeyEncrypted,
  generateFromPhrase,
  getPrivateKeysFilePath,
  getStoredPrivateKeys,
} from '../../services/privateKey';
import { getRecoveryPhrase, getRecoveryPhraseFilePath } from '../../services/recoveryPhrase';

const createChannelName = (...props) => ['privateKey', ...props].join(':');

export default (app: Electron.App) => {
  // Generate key pair
  ipcMain.handle(createChannelName('generate'), async (e, passphrase: string, index: number) => {
    const phrase = await getRecoveryPhrase(getRecoveryPhraseFilePath(app));

    const recoveredMnemonic = await Mnemonic.fromWords(phrase);

    const newKeyPair = await generateFromPhrase(recoveredMnemonic, passphrase, index);

    addPrivateKeyEncrypted(getPrivateKeysFilePath(app), newKeyPair);

    return newKeyPair.toStringRaw();
  });

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStored'), async () => {
    const storedPrivateKeys = await getStoredPrivateKeys(getPrivateKeysFilePath(app));

    return storedPrivateKeys.map(pk => pk.toStringRaw());
  });
};
