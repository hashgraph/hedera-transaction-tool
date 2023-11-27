import fs from 'fs/promises';
import path from 'path';
import { encrypt } from '../utils/crypto';
import { Mnemonic } from '@hashgraph/sdk';
import { dialog, ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', props].join(':');

export default (app: Electron.App) => {
  // Generate
  ipcMain.handle(createChannelName('generate'), async () => {
    const mnemonic = await Mnemonic.generate();

    const words = await mnemonic._mnemonic.words;
    const wordsJSON = JSON.stringify(words);

    const encryptedWords = encrypt(wordsJSON, '123');

    const file = path.join(app.getPath('userData'), 'rphs.json');

    fs.writeFile(file, encryptedWords);

    return Mnemonic.generate();
  });

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
};
