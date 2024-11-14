import { MockedClass, MockedObject } from 'vitest';

import registerUtilsListeners from '@main/modules/ipcHandlers/utils';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';
import { mockDeep } from 'vitest-mock-extended';
import { compareSync, hashSync } from 'bcrypt';
import { getNumberArrayFromString } from '@main/utils';
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
      quit: vi.fn(),
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
    const utils = ['hash', 'saveFile', 'quit'];

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

  test('Should invoke app.quit in util:quit', async () => {
    const quitHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'utils:quit');

    expect(quitHandler).toBeDefined();

    if (quitHandler) {
      await quitHandler[1](event);
      expect(app.quit).toHaveBeenCalled();
    }
  });
});
