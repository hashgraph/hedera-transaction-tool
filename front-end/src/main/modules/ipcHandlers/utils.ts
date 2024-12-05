import fs from 'fs/promises';

import { BrowserWindow, app, dialog, ipcMain, shell, FileFilter } from 'electron';

import * as bcrypt from 'bcrypt';

import { createHash, X509Certificate } from 'crypto';

import { getNumberArrayFromString } from '@main/utils';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (_e, url: string) => shell.openExternal(url));

  ipcMain.on(createChannelName('openPath'), (_e, path: string) => shell.openPath(path));

  ipcMain.handle(createChannelName('hash'), async (_e, data: string): Promise<string> => {
    return await bcrypt.hash(data, 10);
  });

  ipcMain.handle(
    createChannelName('compareHash'),
    async (_e, data: string, hash: string): Promise<boolean> => {
      return await bcrypt.compare(data, hash);
    },
  );

  ipcMain.handle(
    createChannelName('compareDataToHashes'),
    async (_e, data: string, hashes: string[]): Promise<string | null> => {
      for (const hash of hashes) {
        const matched = await bcrypt.compare(data, hash);
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

  ipcMain.handle(createChannelName('sha384'), async (_e, str: string) => {
    return createHash('sha384').update(str).digest('hex');
  });

  ipcMain.handle(createChannelName('x509BytesFromPem'), async (_e, pem: string) => {
    /* Parse the PEM file to get the public key info */
    const cert = new X509Certificate(pem);

    return new Uint8Array(cert.raw);
  });

  ipcMain.handle(createChannelName('quit'), async () => {
    app.quit();
  });
};
