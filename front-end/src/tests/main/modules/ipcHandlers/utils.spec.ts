import { MockedClass, MockedObject } from 'vitest';

import registerUtilsListeners from '@main/modules/ipcHandlers/utils';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { mockDeep } from 'vitest-mock-extended';
import { proto } from '@hashgraph/proto';
import { compareSync, hashSync } from 'bcrypt';
import { getNumberArrayFromString, saveContentToPath } from '@main/utils';
import path from 'path';
import fs from 'fs/promises';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('bcrypt', () => ({ hashSync: vi.fn(), compareSync: vi.fn() }));
vi.mock('electron', () => {
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;
  bw.getAllWindows = vi.fn();
  Object.defineProperty(bw.prototype, 'webContents', {
    value: {
      send: vi.fn(),
    },
    writable: false,
    enumerable: true,
  });

  return {
    BrowserWindow: bw,
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(),
      showItemInFolder: vi.fn(),
      openPath: vi.fn(),
    },
    app: {
      getPath: vi.fn(),
    },
    dialog: { showSaveDialog: vi.fn(), showErrorBox: vi.fn(), showOpenDialog: vi.fn() },
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
      'decodeProtobuffKey',
      'hash',
      'uint8ArrayToHex',
      'hexToUint8Array',
      'hexToUint8ArrayBatch',
      'openBufferInTempFile',
      'saveFile',
    ];

    expect(ipcMainMO.on).toHaveBeenCalledWith('utils:openExternal', expect.any(Function));

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

  test('Should decode key in util:decodeProtobuffKey', () => {
    const encodedKey = 'somekey';

    vi.spyOn(proto.Key, 'decode').mockReturnValue(
      proto.Key.create({ ed25519: Uint8Array.from([1, 2, 3]) }),
    );

    const decodeProtobuffKeyHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:decodeProtobuffKey',
    );

    expect(decodeProtobuffKeyHandler).toBeDefined();

    if (decodeProtobuffKeyHandler) {
      const key = decodeProtobuffKeyHandler[1](event, encodedKey);
      expect(proto.Key.decode).toHaveBeenCalledWith(Buffer.from(encodedKey, 'hex'));
      expect(key).toEqual(proto.Key.create({ ed25519: Uint8Array.from([1, 2, 3]) }));
    }
  });

  test('Should convert uint8 array to hex in util:uint8ArrayToHex', () => {
    const dataString = '1,2,3,4,5,6,7,8,9';
    const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = Buffer.from(data).toString('hex');

    const uint8ArrayToHexHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:uint8ArrayToHex',
    );

    expect(uint8ArrayToHexHandler).toBeDefined();

    if (uint8ArrayToHexHandler) {
      vi.mocked(getNumberArrayFromString).mockReturnValue([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const hex = uint8ArrayToHexHandler[1](event, dataString);
      expect(hex).toEqual(result);
    }
  });

  test('Should convert hex to uint8 array in util:hexToUint8Array', () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const hex = Buffer.from(data).toString('hex');

    const hexToUint8ArrayHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:hexToUint8Array',
    );

    expect(hexToUint8ArrayHandler).toBeDefined();

    if (hexToUint8ArrayHandler) {
      const uint8array = hexToUint8ArrayHandler[1](event, hex);
      const uint8array2 = hexToUint8ArrayHandler[1](event, `0x${hex}`);
      expect(uint8array).toEqual(data.join(','));
      expect(uint8array2).toEqual(data.join(','));
    }
  });

  test('Should convert multiple hexes to uint8 arrays in util:hexToUint8ArrayBatch', () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const data2 = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const hex = Buffer.from(data).toString('hex');
    const hex2 = Buffer.from(data2).toString('hex');

    const hexToUint8ArrayBatchHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:hexToUint8ArrayBatch',
    );

    expect(hexToUint8ArrayBatchHandler).toBeDefined();

    if (hexToUint8ArrayBatchHandler) {
      const uint8array = hexToUint8ArrayBatchHandler[1](event, [hex, `0x${hex2}`]);
      expect(uint8array).toEqual([data.join(','), data2.join(',')]);
    }
  });

  test('Should call save file function and open it in util:openBufferInTempFile', async () => {
    const name = 'fileName';
    const data = '1,2,3,4,5,6,7,8,9';
    const dataBuffer = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const filePath = 'some-path';

    const openBufferInTempFileHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:openBufferInTempFile',
    );

    expect(openBufferInTempFileHandler).toBeDefined();

    if (openBufferInTempFileHandler) {
      vi.mocked(path.join).mockReturnValue(filePath);
      vi.mocked(getNumberArrayFromString).mockReturnValue([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      vi.mocked(saveContentToPath).mockResolvedValue(true);

      await openBufferInTempFileHandler[1](event, name, data);

      expect(app.getPath).toHaveBeenCalledWith('temp');
      expect(path.join).toHaveBeenCalledWith(undefined, 'electronHederaFiles', `${name}.txt`);
      expect(saveContentToPath).toHaveBeenCalledWith(filePath, dataBuffer);
      expect(shell.openPath).toBeCalledWith(filePath);
      expect(shell.showItemInFolder).toBeCalledWith(filePath);
    }
  });

  test('Should throw error if a rejection is faced in util:openBufferInTempFile', () => {
    const name = 'fileName';
    const data = '1,2,3,4,5,6,7,8,9';
    const filePath = 'some-path';

    const openBufferInTempFileHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:openBufferInTempFile',
    );

    expect(openBufferInTempFileHandler).toBeDefined();

    if (openBufferInTempFileHandler) {
      vi.mocked(path.join).mockReturnValue(filePath);
      vi.mocked(getNumberArrayFromString).mockReturnValue([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      vi.mocked(saveContentToPath).mockRejectedValue('some-error');

      expect(() => openBufferInTempFileHandler[1](event, name, data)).rejects.toThrowError(
        'Failed to open file content',
      );
    }
  });

  test('Should save file to a path in util:saveFile', async () => {
    const windows = [{}];
    const uint8ArrayString = 'testString';
    const numberArray = [1, 2, 3];
    const content = Buffer.from(numberArray);
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
    const filePath = 'testPath';
    const canceled = false;

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(windows as unknown as BrowserWindow[]);
    vi.mocked(getNumberArrayFromString).mockReturnValue(numberArray);
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ filePath, canceled: true });

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
    const hash = 'testHash';

    const hashHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:hash');

    expect(hashHandler).toBeDefined();

    if (hashHandler) {
      vi.mocked(hashSync).mockReturnValue(hash);
      const result = hashHandler[1](event, data);
      expect(result).toEqual(hash);
    }
  });

  test('Should compare the data and hash in util:compareHash', () => {
    const data = 'testData';
    const hash = 'testHash';

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:compareHash');

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      vi.mocked(compareSync).mockReturnValue(true);
      const result = compareHashHandler[1](event, data, hash);
      expect(result).toEqual(true);
    }
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return true if match is found', () => {
    const data = 'testData';
    const hash = ['testHash', 'testHash2'];

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:compareDataToHashes',
    );

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      vi.mocked(compareSync).mockReturnValueOnce(false);
      vi.mocked(compareSync).mockReturnValueOnce(true);
      const result = compareHashHandler[1](event, data, hash);

      expect(result).toEqual('testHash2');
    }
  });

  test('Should compare the data to hashes in util:compareDataToHashes and return false if match is NOT found', () => {
    const data = 'testData';
    const hash = ['testHash', 'testHash2'];

    const compareHashHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'utils:compareDataToHashes',
    );

    expect(compareHashHandler).toBeDefined();

    if (compareHashHandler) {
      vi.mocked(compareSync).mockReturnValue(false);
      const result = compareHashHandler[1](event, data, hash);

      expect(result).toEqual(null);
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
});
