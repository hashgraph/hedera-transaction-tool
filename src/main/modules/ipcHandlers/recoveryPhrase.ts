import fs from 'fs/promises';

import { dialog, ipcMain } from 'electron';

import {
  generateRecoveryPhrase,
  encryptRecoveryPhrase,
  getRecoveryPhraseFilePath,
  getRecoveryPhrase,
} from '../../services/recoveryPhrase';

const createChannelName = (...props) => ['recoveryPhrase', ...props].join(':');

export default (app: Electron.App) => {
  // Generate
  ipcMain.handle(createChannelName('generate'), () => generateRecoveryPhrase());

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

  // Encrypt and save the recovery phrase
  ipcMain.handle(
    createChannelName('encryptRecoveryPhrase'),
    async (e, recoveryPhrase: string[]) => {
      await encryptRecoveryPhrase(getRecoveryPhraseFilePath(app), recoveryPhrase);
      return true;
    },
  );

  // Decrypt the recovery phrase
  ipcMain.handle(createChannelName('decryptRecoveryPhrase'), async () => {
    try {
      const recoveryPhrase = await getRecoveryPhrase(getRecoveryPhraseFilePath(app));
      return recoveryPhrase;
    } catch (error) {
      console.log(error);
      return [];
    }
  });
};
