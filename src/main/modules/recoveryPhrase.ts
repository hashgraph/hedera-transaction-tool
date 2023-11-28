import fs from 'fs/promises';
import path from 'path';
import { decrypt, encrypt } from '../utils/crypto';
import { Mnemonic } from '@hashgraph/sdk';
import { dialog, ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', props].join(':');

export default (app: Electron.App) => {
  // Generate
  ipcMain.handle(createChannelName('generate'), async () => {
    const mnemonic = await Mnemonic.generate();

    const words = await mnemonic._mnemonic.words;
    const wordsJSON = JSON.stringify(words);

    const encryptedWords = encrypt(wordsJSON, process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!);

    const file = path.join(app.getPath('userData'), 'recoveryPhraseEnc.json');

    fs.writeFile(file, encryptedWords);

    return Mnemonic.generate();
  });

  // Download recovery phrase object unencrypted
  ipcMain.handle(createChannelName('downloadFileUnencrypted'), async (e, words: string) => {
    const file = await dialog.showSaveDialog({
      defaultPath: './recoveryPhrase.json',
      title: 'Save recovery phrase',
      message: 'Select where to save your recovery phrase as a JSON file',
    });

    if (!file.canceled) {
      fs.writeFile(file.filePath || '', words);
    }
  });

  // Encrypt and save the recovery phrase object
  ipcMain.handle(
    createChannelName('encryptRecoveryPhraseObject'),
    async (e, recoveryPhraseObject: string) => {
      // { recoveryPhrase: [...words], passPhrase: 'password' }
      const encryptedRecoveryPhrase = encrypt(
        recoveryPhraseObject,
        process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
      );

      const file = path.join(app.getPath('userData'), 'recoveryPhraseEncryption.json');

      try {
        await fs.writeFile(file, encryptedRecoveryPhrase);
        return true;
      } catch (error) {
        return false;
      }
    },
  );

  // Decrypt the recovery phrase object
  ipcMain.handle(createChannelName('decryptRecoveryPhraseObject'), async () => {
    const file = path.join(app.getPath('userData'), 'recoveryPhraseEncryption.json');

    try {
      const encryptedRecoveryPhraseObject = await fs.readFile(file);

      // { recoveryPhrase: [...words], passPhrase: 'password' }
      const decryptedRecoveryPhrase = decrypt(
        encryptedRecoveryPhraseObject,
        process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
      );
      return decryptedRecoveryPhrase;
    } catch (error) {
      console.log(error);
      return null;
    }
  });
};
