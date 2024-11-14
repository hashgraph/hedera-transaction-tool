import fs from 'fs/promises';

import { BrowserWindow, app, dialog, ipcMain, shell, FileFilter } from 'electron';

import * as bcrypt from 'bcrypt';

import { getNumberArrayFromString } from '@main/utils';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (_e, url: string) => shell.openExternal(url));

  ipcMain.on(createChannelName('openPath'), (_e, path: string) => shell.openPath(path));

  ipcMain.handle(createChannelName('hash'), (_e, data: string): string => {
    return bcrypt.hashSync(data, 10);
  });

  ipcMain.handle(createChannelName('compareHash'), (_e, data: string, hash: string): boolean => {
    return bcrypt.compareSync(data, hash);
  });

  ipcMain.handle(
    createChannelName('compareDataToHashes'),
    (_e, data: string, hashes: string[]): string | null => {
      for (const hash of hashes) {
        const matched = bcrypt.compareSync(data, hash);
        if (matched) return hash;
      }

      return null;
    },
  );

  ipcMain.handle(createChannelName('saveFile'), async (_e, uint8ArrayString: string) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    const content = Buffer.from(getNumberArrayFromString(uint8ArrayString));

    try {
      const { filePath, canceled } = await dialog.showSaveDialog(windows[0], {
        defaultPath: app.getPath('documents'),
      });
      if (!filePath.trim() || canceled) return;

      try {
        await fs.writeFile(filePath, Uint8Array.from(content));
      } catch (error: any) {
        dialog.showErrorBox('Failed to save file', error?.message || 'Unknown error');
        console.log(error);
      }
    } catch (error: any) {
      dialog.showErrorBox('Failed to save file', error?.message || 'Unknown error');
    }
  });

  ipcMain.handle(
    createChannelName('showOpenDialog'),
    async (
      _e,
      title: string,
      buttonLabel: string,
      filters: FileFilter[],
      properties: ('openFile' | 'openDirectory' | 'multiSelections')[],
      message: string,
    ) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) return;

      return await dialog.showOpenDialog(windows[0], {
        title,
        buttonLabel,
        filters,
        properties,
        message,
      });
    },
  );

  ipcMain.handle(createChannelName('quit'), async () => {
    app.quit();
  });
};
