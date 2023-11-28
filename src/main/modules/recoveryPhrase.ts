import fs from 'fs/promises';
import path from 'path';
import { decrypt, encrypt } from '../utils/crypto';
import { Mnemonic } from '@hashgraph/sdk';
import { dialog, ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', props].join(':');

export default (app: Electron.App) => {
  // Generate
  ipcMain.handle(createChannelName('generate'), async () => Mnemonic.generate());

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

  const recoveryPhraseFile = path.join(app.getPath('userData'), 'recoveryPhraseEncryption.json');

  // Encrypt and save the recovery phrase
  ipcMain.handle(
    createChannelName('encryptRecoveryPhrase'),
    async (e, recoveryPhraseJSON: string) => {
      // [..words]
      const encryptedRecoveryPhrase = encrypt(
        recoveryPhraseJSON,
        process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
      );

      try {
        await fs.writeFile(recoveryPhraseFile, encryptedRecoveryPhrase);
        return true;
      } catch (error) {
        return false;
      }
    },
  );

  // Decrypt the recovery phrase
  ipcMain.handle(createChannelName('decryptRecoveryPhrase'), async () => {
    try {
      const encryptedRecoveryPhraseObject = await fs.readFile(recoveryPhraseFile);

      // [..words]
      const decryptedRecoveryPhrase = decrypt(
        encryptedRecoveryPhraseObject,
        process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
      );

      return decryptedRecoveryPhrase;
    } catch (error) {
      console.log(error);
      return [];
    }
  });
};
