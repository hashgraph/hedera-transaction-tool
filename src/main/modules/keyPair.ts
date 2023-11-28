import fs from 'fs/promises';
import path from 'path';
import { decrypt, encrypt } from '../utils/crypto';
import { Mnemonic } from '@hashgraph/sdk';
import { ipcMain } from 'electron';
import { getRecoveryPhrase } from './recoveryPhrase';

const createChannelName = (...props) => ['keyPair', props].join(':');

export const keyPairsFileName = 'keyPairs.json';

export const getStoredKeyPairs = async (app: Electron.App) => {
  const keyPairsFile = path.join(app.getPath('userData'), keyPairsFileName);

  try {
    const encryptedKeyPairs = await fs.readFile(keyPairsFile);

    const decryptedKeyPairs = decrypt(encryptedKeyPairs, process.env.KEY_PAIRS_ENCRYPTION_KEY!);

    return JSON.parse(decryptedKeyPairs);
  } catch (error) {
    console.log(error);
    return [];
  }
};

export default (app: Electron.App) => {
  const keyPairsFile = path.join(app.getPath('userData'), keyPairsFileName);

  // Generate key pair
  ipcMain.handle(createChannelName('generate'), async (e, passphrase: string, index: number) => {
    const phrase = await getRecoveryPhrase(app);

    const recoveredMnemonic = await Mnemonic.fromWords(phrase);
    const recoveredKey = await recoveredMnemonic.toStandardEd25519PrivateKey(passphrase, index);

    const privateKey = recoveredKey.toString();
    const publicKey = recoveredKey.publicKey.toStringDer();

    const newKeyPair = { privateKey, publicKey };

    const storedKeyPairs = await getStoredKeyPairs(app);

    const newKeyPairs = JSON.stringify([...storedKeyPairs, newKeyPair]);

    const encryptedKeyPairs = encrypt(newKeyPairs, process.env.KEY_PAIRS_ENCRYPTION_KEY!);

    await fs.writeFile(keyPairsFile, encryptedKeyPairs);

    return newKeyPair;
  });

  // Decrypt stored key pairs
  ipcMain.handle(createChannelName('getStored'), async () => {
    return await getStoredKeyPairs(app);
  });
};
