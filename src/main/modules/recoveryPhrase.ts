import fs from 'fs/promises';
import path from 'path';
import { decrypt, encrypt } from '../utils/crypto';
import { Mnemonic } from '@hashgraph/sdk';
import { dialog, ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', props].join(':');

export const recoveryPhraseFileName = 'recoveryPhraseEncryption.json';

export const getRecoveryPhrase = async (app: Electron.App) => {
  const recoveryPhraseFile = path.join(app.getPath('userData'), recoveryPhraseFileName);

  const encryptedRecoveryPhrase = await fs.readFile(recoveryPhraseFile);

  // [..words]
  const decryptedRecoveryPhrase = decrypt(
    encryptedRecoveryPhrase,
    process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
  );

  return JSON.parse(decryptedRecoveryPhrase);
};

export default (app: Electron.App) => {
  // Generate
  ipcMain.handle(createChannelName('generate'), async () => Mnemonic.generate());

  // Download recovery phrase object unencrypted
  ipcMain.handle(createChannelName('downloadFileUnencrypted'), async (e, words: string[]) => {
    const file = await dialog.showSaveDialog({
      defaultPath: './recoveryPhrase.json',
      title: 'Save recovery phrase',
      message: 'Select where to save your recovery phrase as a JSON file',
    });

    if (!file.canceled) {
      fs.writeFile(file.filePath || '', JSON.stringify(words));
    }
  });

  const recoveryPhraseFile = path.join(app.getPath('userData'), recoveryPhraseFileName);

  // Encrypt and save the recovery phrase
  ipcMain.handle(
    createChannelName('encryptRecoveryPhrase'),
    async (e, recoveryPhrase: string[]) => {
      // [..words]
      const encryptedRecoveryPhrase = encrypt(
        JSON.stringify(recoveryPhrase),
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
      return await getRecoveryPhrase(app);
    } catch (error) {
      console.log(error);
      return [];
    }
  });
};
