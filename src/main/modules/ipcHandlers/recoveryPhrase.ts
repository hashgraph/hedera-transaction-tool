import fs from 'fs/promises';

import { dialog, ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', ...props].join(':');

export default () => {
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
};
