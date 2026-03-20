import fs from 'fs';

import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  shell,
  FileFilter,
  OpenDialogReturnValue,
  SaveDialogReturnValue,
} from 'electron';

import { createHash, X509Certificate } from 'crypto';

import { getNumberArrayFromString } from '@main/utils';
import { dualCompareHash, hash } from '@main/utils/crypto';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');
let bounceId: number | null = null;

interface DialogMockState {
  savePath: string | null;
  openPaths: string[];
}

const defaultDialogMockState = (): DialogMockState => ({
  savePath: null,
  openPaths: [],
});

const normalizeSavePath = (
  value: unknown,
  fallback: string | null,
): string | null => {
  if (value === undefined) return fallback;

  return typeof value === 'string' || value === null ? value : fallback;
};

const normalizeOpenPaths = (
  value: unknown,
  fallback: string[],
): string[] => {
  if (value === undefined || !Array.isArray(value)) return [...fallback];

  const next: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      next.push(item);
    }
  }

  return next;
};

let dialogMockState = defaultDialogMockState();

const isPlaywrightTestSession = () => process.env.PLAYWRIGHT_TEST === 'true';

const getMockedSaveDialogResult = (): SaveDialogReturnValue => ({
  canceled: false,
  filePath: dialogMockState.savePath ?? '',
});

const getMockedOpenDialogResult = (): OpenDialogReturnValue => ({
  canceled: false,
  filePaths: [...dialogMockState.openPaths],
});

export default () => {
  ipcMain.on(createChannelName('setDockBounce'), (_e, bounce: boolean) => {
    if (bounce) {
      const windows = BrowserWindow.getAllWindows();
      const isAppFocused = windows.some(win => win.isFocused());

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
    createChannelName('test', 'setDialogMockState'),
    (_e, state: Partial<DialogMockState>): void => {
      dialogMockState = {
        savePath: normalizeSavePath(state.savePath, dialogMockState.savePath),
        openPaths: normalizeOpenPaths(state.openPaths, dialogMockState.openPaths),
      };
    },
  );

  ipcMain.handle(createChannelName('test', 'clearDialogMockState'), async (): Promise<void> => {
    dialogMockState = defaultDialogMockState();
  });

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
      const { filePath, canceled } = isPlaywrightTestSession()
        ? getMockedSaveDialogResult()
        : await dialog.showSaveDialog(windows[0], {
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
    createChannelName('saveFileToPath'),
    async (
      _e,
      data: Uint8Array | string,
      filePath: string,
    ) => {
      try {
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

      if (isPlaywrightTestSession()) {
        return getMockedOpenDialogResult();
      }

      return await dialog.showOpenDialog(windows[0], {
        title,
        buttonLabel,
        filters,
        properties,
        message,
      });
    },
  );

  ipcMain.handle(
    createChannelName('showSaveDialog'),
    async (
      _e,
      name: string,
      title: string,
      buttonLabel: string,
      filters: FileFilter[],
      message: string
    ) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) return;

      if (isPlaywrightTestSession()) {
        return getMockedSaveDialogResult();
      }

      return await dialog.showSaveDialog(windows[0], {
        title,
        defaultPath: name,
        buttonLabel,
        filters,
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
