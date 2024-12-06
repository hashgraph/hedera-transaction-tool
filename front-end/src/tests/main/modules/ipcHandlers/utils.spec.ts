import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerUtilsListeners from '@main/modules/ipcHandlers/utils';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { compare, hash } from 'bcrypt';
import { getNumberArrayFromString } from '@main/utils';
import fs from 'fs/promises';
import { createHash, X509Certificate } from 'crypto';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('bcrypt', () => ({ hash: vi.fn(), compare: vi.fn() }));
vi.mock('crypto');
vi.mock('electron', () => {
  return {
    default: mockDeep<Electron.App>(),
    app: mockDeep<Electron.App>(),
    BrowserWindow: mockDeep<BrowserWindow>(),
    shell: mockDeep<Electron.Session>(),
    dialog: mockDeep<Electron.Session>(),
    ipcMain: mockDeep<Electron.IpcMain>(),
  };
});
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
  },
}));
vi.mock('path', () => ({
  default: {
    join: vi.fn(),
  },
}));
vi.mock('@hashgraph/proto', () => ({
  proto: {
    Key: {
      create: vi.fn(),
      decode: vi.fn(),
    },
  },
}));
vi.mock('@main/utils/crypto', () => ({
  hash: vi.fn(),
}));
vi.mock('@main/utils', () => {
  return {
    getNumberArrayFromString: vi.fn(),
    saveContentToPath: vi.fn(),
  };
});

describe('createChannelName', () => {
  test('Should create correct channel name', () => {
    registerUtilsListeners();

    expect(ipcMain.on).toHaveBeenCalledWith('utils:openExternal', expect.any(Function));
  });
});

describe('registerUtilsListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerUtilsListeners();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each util', () => {
    const utils = [
      'hash',
      'compareHash',
      'compareDataToHashes',
      'saveFile',
      'showOpenDialog',
      'sha384',
      'x509BytesFromPem',
      'quit',
    ];

    expect(ipcMainMO.on).toHaveBeenCalledWith('utils:openExternal', expect.any(Function));

    console.log(ipcMainMO.handle.mock.calls);

    expect(
      utils.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `utils:${util}`),
      ),
    ).toBe(true);
  });

  test('Should call open external on util:openExternal', () => {
    const url = 'some-url.com';

    const openExternalHandler = ipcMainMO.on.mock.calls.find(([event]) => {
      return event === 'utils:openExternal';
    });
    openExternalHandler && openExternalHandler[1](event, url);
    expect(shell.openExternal).toHaveBeenCalledWith(url);
  });

  test('Should save file to a path in util:saveFile', async () => {
    const windows = [{}];
    const uint8ArrayString = 'testString';
    const numberArray = [1, 2, 3];
    const content = Uint8Array.from(numberArray);
    const filePath = 'testPath';
    const canceled = false;

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(getNumberArrayFromString).mockReturnValue(numberArray);
    vi.mocked(app.getPath).mockReturnValue('documents');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ filePath, canceled });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const saveFileHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:saveFile');

    expect(saveFileHandler).toBeDefined();

    if (saveFileHandler) {
      await saveFileHandler[1](event, uint8ArrayString);
    }

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(getNumberArrayFromString).toHaveBeenCalledWith(uint8ArrayString);
    expect(app.getPath).toHaveBeenCalledWith('documents');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(windows[0], { defaultPath: 'documents' });
    expect(fs.writeFile).toHaveBeenCalledWith(filePath, content);
  });

  test('Should do nothing if no windows in util:saveFile', async () => {
    const windows = [];

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows);

    const saveFileHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:saveFile');

    expect(saveFileHandler).toBeDefined();

    if (saveFileHandler) {
      await saveFileHandler[1](event);
    }

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(getNumberArrayFromString).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  test('Should not write if no file path or canceled dialog in util:saveFile', async () => {
    const windows = [{}];
    const uint8ArrayString = 'testString';
    const numberArray = [1, 2, 3];

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(getNumberArrayFromString).mockReturnValue(numberArray);
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ filePath: '', canceled: false });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
      filePath: 'testPath',
      canceled: true,
    });

    const saveFileHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:saveFile');

    expect(saveFileHandler).toBeDefined();

    if (saveFileHandler) {
      await saveFileHandler[1](event, uint8ArrayString);
      expect(fs.writeFile).not.toHaveBeenCalled();
      await saveFileHandler[1](event, uint8ArrayString);
      expect(fs.writeFile).not.toHaveBeenCalled();
    }
  });

  test('Should show error in dialog if fail to write in util:saveFile', async () => {
    const windows = [{}];
    const uint8ArrayString = 'testString';
    const numberArray = [1, 2, 3];
    const filePath = 'testPath';
    const canceled = false;

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(getNumberArrayFromString).mockReturnValue(numberArray);
    vi.mocked(app.getPath).mockReturnValue('documents');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ filePath, canceled });
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('An error'));
    vi.mocked(fs.writeFile).mockRejectedValueOnce(undefined);

    const saveFileHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:saveFile');

    expect(saveFileHandler).toBeDefined();

    if (saveFileHandler) {
      await saveFileHandler[1](event, uint8ArrayString);
      expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
      await saveFileHandler[1](event, uint8ArrayString);
      expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
    }
  });

  test('Should show error in dialog if error in util:saveFile', async () => {
    const windows = [{}];
    const uint8ArrayString = 'testString';
    const numberArray = [1, 2, 3];

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(getNumberArrayFromString).mockReturnValue(numberArray);
    vi.mocked(app.getPath).mockReturnValue('documents');
    vi.mocked(dialog.showSaveDialog).mockRejectedValueOnce(new Error('An error'));
    vi.mocked(dialog.showSaveDialog).mockRejectedValueOnce(undefined);

    const saveFileHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:saveFile');

    expect(saveFileHandler).toBeDefined();

    if (saveFileHandler) {
      await saveFileHandler[1](event, uint8ArrayString);
      expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
      await saveFileHandler[1](event, uint8ArrayString);
      expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
    }
  });

  test('Should hash the data in util:hash', () => {
    const data = 'testData';

    const hashHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:hash');

    expect(hashHandler).toBeDefined();

    if (hashHandler) {
      hashHandler[1](event, data);
      expect(hash).toHaveBeenCalledWith(data, 10);
    }
  });

  test('Should compare the data and hash in util:compareHash', () => {
    const data = 'testData';
    const hashData = 'testHash';

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:compareHash');

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      compareHashHandler[1](event, data, hashData);
      expect(compare).toHaveBeenCalledWith(data, hashData);
    }
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return true if match is found', () => {
    const data = 'testData';
    const hashData = ['testHash', 'testHash2'];

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:compareDataToHashes',
    );

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      compareHashHandler[1](event, data, hashData);
      expect(compare).toHaveBeenCalledWith(data, hashData[0]);
    }
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return false if match is NOT found', () => {
    const data = 'testData';
    const hashData = ['testHash', 'testHash2'];

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:compareDataToHashes',
    );

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      // @ts-ignore - incorrect overload
      vi.mocked(compare).mockResolvedValueOnce(true);
      compareHashHandler[1](event, data, hashData);
      expect(compare).toHaveBeenCalledWith(data, hashData[0]);
    }
  });

  test('Should call showOpenDialog with correct parameters in util:showOpenDialog', async () => {
    const windows = [{}];
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    const showOpenDialogHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:showOpenDialog',
    );

    expect(showOpenDialogHandler).toBeDefined();

    if (showOpenDialogHandler) {
      const dialogReturnValue = { filePaths: ['/path/to/file.txt'], canceled: false };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
      vi.mocked(dialog.showOpenDialog).mockResolvedValue(dialogReturnValue);

      const result = await showOpenDialogHandler[1](
        event,
        title,
        buttonLabel,
        filters,
        properties,
        message,
      );

      expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(windows[0], {
        title,
        buttonLabel,
        filters,
        properties,
        message,
      });
      expect(result).toEqual(dialogReturnValue);
    }
  });

  test('Should return undefined if no windows in util:showOpenDialog', async () => {
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    const showOpenDialogHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:showOpenDialog',
    );

    expect(showOpenDialogHandler).toBeDefined();

    if (showOpenDialogHandler) {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

      const result = await showOpenDialogHandler[1](
        event,
        title,
        buttonLabel,
        filters,
        properties,
        message,
      );

      expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
      expect(dialog.showOpenDialog).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    }
  });

  test('Should return undefined if dialog is canceled in util:showOpenDialog', async () => {
    const windows = [{}];
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    const showOpenDialogHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:showOpenDialog',
    );

    expect(showOpenDialogHandler).toBeDefined();

    if (showOpenDialogHandler) {
      const dialogReturnValue = { filePaths: [], canceled: true };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
      vi.mocked(dialog.showOpenDialog).mockResolvedValue(dialogReturnValue);

      const result = await showOpenDialogHandler[1](
        event,
        title,
        buttonLabel,
        filters,
        properties,
        message,
      );

      expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(windows[0], {
        title,
        buttonLabel,
        filters,
        properties,
        message,
      });
      expect(result).toBe(dialogReturnValue);
    }
  });

  test('Should invoke app.quit in util:quit', async () => {
    const quitHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:quit');

    expect(quitHandler).toBeDefined();

    if (quitHandler) {
      await quitHandler[1](event);
      expect(app.quit).toHaveBeenCalled();
    }
  });

  test('Should hash the data in util:sha384', async () => {
    const data = 'testData';
    const hashedData = 'hashedData';

    vi.mocked(createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue(hashedData),
    } as unknown as ReturnType<typeof createHash>);

    const sha384Handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:sha384');

    expect(sha384Handler).toBeDefined();

    if (sha384Handler) {
      const result = await sha384Handler[1](event, data);
      expect(createHash).toHaveBeenCalledWith('sha384');
      expect(result).toBe(hashedData);
    }
  });

  describe('x509BytesFromPem', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      registerUtilsListeners();
    });

    test('Should handle x509BytesFromPem with PEM string', async () => {
      const pem =
        '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1\n-----END CERTIFICATE-----';
      const certRaw = new Uint8Array([1, 2, 3, 4]);
      const certHash = 'hashedCert';
      const certText = 'certText';

      const mockX509Certificate = {
        raw: certRaw,
        toString: vi.fn().mockReturnValue(certText),
      };

      vi.mocked(X509Certificate).mockImplementation(
        () => mockX509Certificate as unknown as X509Certificate,
      );
      vi.mocked(createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(certHash),
      } as unknown as ReturnType<typeof createHash>);

      const x509BytesFromPemHandler = ipcMainMO.handle.mock.calls.find(
        ([e]) => e === 'utils:x509BytesFromPem',
      );

      expect(x509BytesFromPemHandler).toBeDefined();

      if (x509BytesFromPemHandler) {
        const result = await x509BytesFromPemHandler[1](event, pem);
        expect(result).toEqual({
          raw: certRaw,
          hash: certHash,
          text: certText,
        });
      }
    });

    test('Should handle x509BytesFromPem with hex PEM string', async () => {
      const pem =
        '2d2d2d2d2d424547494e2043455254494649434154452d2d2d2d2d0a4d494942496a414e42676b7168696b693947397730304241514541310a2d2d2d2d2d454e442043455254494649434154452d2d2d2d2d';
      const certRaw = new Uint8Array([1, 2, 3, 4]);
      const certHash = 'hashedCert';
      const certText = 'certText';

      const mockX509Certificate = {
        raw: certRaw,
        toString: vi.fn().mockReturnValue(certText),
      };

      vi.mocked(X509Certificate).mockImplementation(
        () => mockX509Certificate as unknown as X509Certificate,
      );
      vi.mocked(createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(certHash),
      } as unknown as ReturnType<typeof createHash>);

      const x509BytesFromPemHandler = ipcMainMO.handle.mock.calls.find(
        ([e]) => e === 'utils:x509BytesFromPem',
      );

      expect(x509BytesFromPemHandler).toBeDefined();

      if (x509BytesFromPemHandler) {
        const result = await x509BytesFromPemHandler[1](event, pem);
        expect(result).toEqual({
          raw: certRaw,
          hash: certHash,
          text: certText,
        });
      }
    });

    test('Should handle x509BytesFromPem with Uint8Array', async () => {
      const pem = new Uint8Array([48, 130, 1, 10, 2, 130, 1, 1, 0, 217, 48, 130, 1, 10]);
      const certRaw = new Uint8Array([1, 2, 3, 4]);
      const certHash = 'hashedCert';
      const certText = 'certText';

      const mockX509Certificate = {
        raw: certRaw,
        toString: vi.fn().mockReturnValue(certText),
      };

      vi.mocked(X509Certificate).mockImplementation(
        () => mockX509Certificate as unknown as X509Certificate,
      );
      vi.mocked(createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(certHash),
      } as unknown as ReturnType<typeof createHash>);

      const x509BytesFromPemHandler = ipcMainMO.handle.mock.calls.find(
        ([e]) => e === 'utils:x509BytesFromPem',
      );

      expect(x509BytesFromPemHandler).toBeDefined();

      if (x509BytesFromPemHandler) {
        const result = await x509BytesFromPemHandler[1](event, pem);
        expect(result).toEqual({
          raw: certRaw,
          hash: certHash,
          text: certText,
        });
      }
    });

    test('Should throw error for invalid PEM in x509BytesFromPem', async () => {
      const pem = 'invalid-pem';

      const x509BytesFromPemHandler = ipcMainMO.handle.mock.calls.find(
        ([e]) => e === 'utils:x509BytesFromPem',
      );

      expect(x509BytesFromPemHandler).toBeDefined();

      if (x509BytesFromPemHandler) {
        await expect(x509BytesFromPemHandler[1](event, pem)).rejects.toThrow('Invalid PEM');
      }
    });
  });
});
