import fs from 'fs';

import { BrowserWindow, app, dialog, ipcMain, shell, FileFilter } from 'electron';

import { createHash, X509Certificate } from 'crypto';

import { getNumberArrayFromString } from '@main/utils';
import { dualCompareHash, hash } from '@main/utils/crypto';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');
let bounceId: number | null = null;

export default () => {
  ipcMain.on(createChannelName('setDockBounce'), (_e, bounce: boolean) => {
    if (bounce) {
      const windows = BrowserWindow.getAllWindows();
      const isAppFocused = windows.some((win) => win.isFocused());

      if (!isAppFocused && app.dock) {
        bounceId = app.dock.bounce('critical');
      }
    } else {
      if (bounceId !== null && app.dock) {
        app.dock.cancelBounce(bounceId);
        bounceId = null;
      }
    }
  });

  ipcMain.on(createChannelName('openExternal'), (_e, url: string) => shell.openExternal(url));

  ipcMain.on(createChannelName('openPath'), (_e, path: string) => shell.openPath(path));

  ipcMain.handle(
    createChannelName('hash'),
    async (_e, data: string, pseudoSalt = false): Promise<string> => {
      return await hash(data, pseudoSalt);
    },
  );

  ipcMain.handle(
    createChannelName('compareHash'),
    async (_e, data: string, hash: string): Promise<boolean> => {
      const { correct } = await dualCompareHash(data, hash);
      return correct;
    },
  );

  ipcMain.handle(
    createChannelName('compareDataToHashes'),
    async (_e, data: string, hashes: string[]): Promise<string | null> => {
      for (const hash of hashes) {
        const { correct } = await dualCompareHash(data, hash);
        if (correct) return hash;
      }

      return null;
    },
  );

  ipcMain.handle(createChannelName('saveFile'), async (_e, uint8ArrayString: string) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    try {
      const { filePath, canceled } = await dialog.showSaveDialog(windows[0], {
        defaultPath: app.getPath('documents'),
      });
      if (!filePath.trim() || canceled) return;

      const content = Buffer.from(getNumberArrayFromString(uint8ArrayString));
      await fs.promises.writeFile(filePath, Uint8Array.from(content));
    } catch (error: unknown) {
      if (error instanceof Error) {
        dialog.showErrorBox('Failed to save file', error.message);
      } else {
        dialog.showErrorBox('Failed to save file', 'Unknown error');
      }
    }
  });

  ipcMain.handle(
    createChannelName('saveFileNamed'),
    async (
      _e,
      data: Uint8Array,
      name: string,
      title: string,
      buttonLabel: string,
      filters: FileFilter[],
      message: string,
    ) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) return;

      try {
        const {canceled, filePath} = await dialog.showSaveDialog(windows[0], {
          title,
          defaultPath: name,
          buttonLabel,
          filters,
          message,
        });

        if (canceled) return;
        if (!filePath) throw new Error('File path is undefined');

        await fs.promises.writeFile(filePath, data);
      } catch (error: unknown) {
        if (error instanceof Error) {
          dialog.showErrorBox('Failed to save file', error.message);
        } else {
          dialog.showErrorBox('Failed to save file', 'Unknown error');
        }
      }
    },
  );

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

  ipcMain.handle(createChannelName('sha384'), async (_e, str: string): Promise<string> => {
    return await createHash('sha384').update(str).digest('hex');
  });

  ipcMain.handle(createChannelName('x509BytesFromPem'), async (_e, pem: string | Uint8Array) => {
    const PEM_HEADER = '-----BEGIN CERTIFICATE-----';

    if (
      !pem ||
      (typeof pem === 'string' && pem.trim() === '') ||
      (pem instanceof Uint8Array && pem.length === 0)
    ) {
      return;
    }

    let cert: X509Certificate | null = null;

    if (pem instanceof Uint8Array) {
      cert = new X509Certificate(pem);
    } else {
      let pemData: Buffer | string = '';
      const pemBufferFromHex = Buffer.from(pem, 'hex');

      if (pem.includes(PEM_HEADER)) {
        pemData = Buffer.from(pem, 'utf8');
      } else if (pemBufferFromHex.length > 0) {
        pemData = pemBufferFromHex;
      }

      if (!pemData || pemData.length === 0) {
        throw new Error('Invalid PEM');
      }

      cert = new X509Certificate(pemData);
    }

    return {
      raw: new Uint8Array(cert.raw),
      hash: createHash('sha384').update(cert.raw).digest('hex'),
      text: cert.toString(),
    };
  });

  ipcMain.handle(createChannelName('quit'), async () => {
    app.quit();
  });
};
