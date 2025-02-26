import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, getIPCListener, invokeIPCHandler, invokeIPCListener } from '../../_utils_';

import registerUtilsListeners from '@main/modules/ipcHandlers/utils';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { getNumberArrayFromString } from '@main/utils';
import { hash, dualCompareHash } from '@main/utils/crypto';
import fs from 'fs';
import { createHash, X509Certificate } from 'crypto';

vi.mock('bcrypt', () => mockDeep());
vi.mock('crypto', () => mockDeep());
vi.mock('electron', () => mockDeep());
vi.mock('fs', () => mockDeep());
vi.mock('path', () => mockDeep());
vi.mock('path', () => mockDeep());
vi.mock('@hashgraph/proto', () => mockDeep());
vi.mock('@main/utils/crypto', () => mockDeep());
vi.mock('@main/utils', () => mockDeep());

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

  test('Should register handlers for each util', () => {
    const eventListeners = ['openExternal', 'openPath'];
    const eventHandlers = [
      'hash',
      'compareHash',
      'compareDataToHashes',
      'saveFile',
      'showOpenDialog',
      'saveFileNamed',
      'sha384',
      'x509BytesFromPem',
      'quit',
    ];

    expect(eventListeners.every(util => getIPCListener(`utils:${util}`))).toBe(true);
    expect(eventHandlers.every(util => getIPCHandler(`utils:${util}`))).toBe(true);
  });

  test('Should call open external on util:openExternal', async () => {
    const url = 'some-url.com';

    await invokeIPCListener('utils:openExternal', url);
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
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

    await invokeIPCHandler('utils:saveFile', uint8ArrayString);

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(getNumberArrayFromString).toHaveBeenCalledWith(uint8ArrayString);
    expect(app.getPath).toHaveBeenCalledWith('documents');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(windows[0], { defaultPath: 'documents' });
    expect(fs.promises.writeFile).toHaveBeenCalledWith(filePath, content);
  });

  test('Should do nothing if no windows in util:saveFile', async () => {
    const windows = [];

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows);

    await invokeIPCHandler('utils:saveFile');

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(getNumberArrayFromString).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
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

    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
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
    vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(new Error('An error'));
    vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(undefined);

    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
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

    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
    await invokeIPCHandler('utils:saveFile', uint8ArrayString);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
  });

  test('Should hash the data in util:hash', async () => {
    const data = 'testData';

    await invokeIPCHandler('utils:hash', data);

    expect(hash).toHaveBeenCalledWith(data, false);
  });

  test('Should compare the data and hash in util:compareHash', async () => {
    const data = 'testData';
    const hashData = 'testHash';

    vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });

    await invokeIPCHandler('utils:compareHash', data, hashData);
    expect(dualCompareHash).toHaveBeenCalledWith(data, hashData);
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return the hash if match is found', async () => {
    const data = 'testData';
    const hashData = ['testHash', 'testHash2'];

    vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });
    await invokeIPCHandler('utils:compareDataToHashes', data, hashData);
    expect(dualCompareHash).toHaveBeenCalledWith(data, hashData[0]);
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return null if match is NOT found', async () => {
    const data = 'testData';
    const hashData = ['testHash', 'testHash2'];

    vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });
    vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });
    const result = await invokeIPCHandler('utils:compareDataToHashes', data, hashData);
    expect(dualCompareHash).toHaveBeenCalledWith(data, hashData[0]);
    expect(dualCompareHash).toHaveBeenCalledWith(data, hashData[1]);
    expect(result).toBeNull();
  });

  test('Should call showOpenDialog with correct parameters in util:showOpenDialog', async () => {
    const windows = [{}];
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    const dialogReturnValue = { filePaths: ['/path/to/file.txt'], canceled: false };
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue(dialogReturnValue);

    const result = await invokeIPCHandler(
      'utils:showOpenDialog',
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
  });

  test('Should return undefined if no windows in util:showOpenDialog', async () => {
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const result = await invokeIPCHandler(
      'utils:showOpenDialog',
      title,
      buttonLabel,
      filters,
      properties,
      message,
    );

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test('Should return undefined if dialog is canceled in util:showOpenDialog', async () => {
    const windows = [{}];
    const title = 'Open File';
    const buttonLabel = 'Open';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const properties = ['openFile'];
    const message = 'Select a file to open';

    const dialogReturnValue = { filePaths: [], canceled: true };
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue(dialogReturnValue);

    const result = await invokeIPCHandler(
      'utils:showOpenDialog',
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
  });

  test('Should save file to a path in util:saveFileNamed', async () => {
    const windows = [{}];
    const data = new Uint8Array([1, 2, 3, 4]);
    const name = 'test.txt';
    const title = 'Save File';
    const buttonLabel = 'Save';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const message = 'Select a file to save';
    const dialogReturnValue = { filePath: '/path/to/test.txt', canceled: false };

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue(dialogReturnValue);

    await invokeIPCHandler(
      'utils:saveFileNamed',
      data,
      name,
      title,
      buttonLabel,
      filters,
      message,
    );

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(windows[0], {
      title,
      defaultPath: name,
      buttonLabel,
      filters,
      message,
    });
    expect(fs.promises.writeFile).toHaveBeenCalledWith('/path/to/test.txt', data);
  });

  test('Should not write if no file path or canceled dialog in util:saveFileNamed', async () => {
    const windows = [{}];
    const data = new Uint8Array([1, 2, 3, 4]);
    const name = 'test.txt';
    const title = 'Save File';
    const buttonLabel = 'Save';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const message = 'Select a file to save';

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ filePath: '', canceled: true });

    await invokeIPCHandler(
      'utils:saveFileNamed',
      data,
      name,
      title,
      buttonLabel,
      filters,
      message,
    );

    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  test('Should do nothing if no windows in util:saveFileNamed', async () => {
    const windows = [];

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows);

    await invokeIPCHandler('utils:saveFileNamed');

    expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  test('Should show error in dialog if fail to write in util:saveFileNamed', async () => {
    const windows = [{}];
    const data = new Uint8Array([1, 2, 3, 4]);
    const name = 'test.txt';
    const title = 'Save File';
    const buttonLabel = 'Save';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const message = 'Select a file to save';
    const filePath = 'testPath';
    const canceled = false;

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ filePath, canceled });
    vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(new Error('An error'));
    vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(undefined);

    await invokeIPCHandler('utils:saveFileNamed', data, name, title, buttonLabel, filters, message);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
    await invokeIPCHandler('utils:saveFileNamed', data, name, title, buttonLabel, filters, message);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
  });

  test('Should show error in dialog if error in util:saveFileNamed', async () => {
    const windows = [{}];
    const data = new Uint8Array([1, 2, 3, 4]);
    const name = 'test.txt';
    const title = 'Save File';
    const buttonLabel = 'Save';
    const filters = [{ name: 'Text Files', extensions: ['txt'] }];
    const message = 'Select a file to save';

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(dialog.showSaveDialog).mockRejectedValueOnce(new Error('An error'));
    vi.mocked(dialog.showSaveDialog).mockRejectedValueOnce(undefined);

    await invokeIPCHandler('utils:saveFileNamed', data, name, title, buttonLabel, filters, message);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'An error');
    await invokeIPCHandler('utils:saveFileNamed', data, name, title, buttonLabel, filters, message);
    expect(dialog.showErrorBox).toHaveBeenCalledWith('Failed to save file', 'Unknown error');
  });

  test('Should invoke app.quit in util:quit', async () => {
    await invokeIPCHandler('utils:quit');
    expect(app.quit).toHaveBeenCalled();
  });

  test('Should hash the data in util:sha384', async () => {
    const data = 'testData';
    const hashedData = 'hashedData';

    vi.mocked(createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue(hashedData),
    } as unknown as ReturnType<typeof createHash>);

    const result = await invokeIPCHandler('utils:sha384', data);

    expect(createHash).toHaveBeenCalledWith('sha384');
    expect(result).toBe(hashedData);
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

      const result = await invokeIPCHandler('utils:x509BytesFromPem', pem);
      expect(result).toEqual({
        raw: certRaw,
        hash: certHash,
        text: certText,
      });
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

      const result = await invokeIPCHandler('utils:x509BytesFromPem', pem);
      expect(result).toEqual({
        raw: certRaw,
        hash: certHash,
        text: certText,
      });
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

      const result = await invokeIPCHandler('utils:x509BytesFromPem', pem);
      expect(result).toEqual({
        raw: certRaw,
        hash: certHash,
        text: certText,
      });
    });

    test('Should throw error for invalid PEM in x509BytesFromPem', async () => {
      const pem = 'invalid-pem';

      await expect(invokeIPCHandler('utils:x509BytesFromPem', pem)).rejects.toThrow('Invalid PEM');
    });

    test('Should return undefined if no PEM in x509BytesFromPem', async () => {
      const pem = '';

      const result = await invokeIPCHandler('utils:x509BytesFromPem', pem);
      expect(result).toBeUndefined();
    });
  });
});
