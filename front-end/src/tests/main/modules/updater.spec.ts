import { MockedClass, MockedObject } from 'vitest';

import updater from '@main/modules/updater';

import { BrowserWindow, ipcMain } from 'electron';
import { AppUpdater, ProgressInfo, UpdateInfo, autoUpdater } from 'electron-updater';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => {
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;

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
    },
  };
});

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    checkForUpdates: vi.fn(),
  },
}));

describe('updater', () => {
  let window: BrowserWindow;

  beforeEach(() => {
    vi.resetAllMocks();
    window = new BrowserWindow();
  });

  test('Should handle update events', () => {
    updater(window);

    expect(autoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
    expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
    expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
    expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
    expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));

    expect(ipcMain.on).toHaveBeenCalledWith('update:download-update', expect.any(Function));
    expect(ipcMain.on).toHaveBeenCalledWith('update:quit-install', expect.any(Function));

    expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
  });

  test('Should handle update events', () => {
    updater(window);

    const autoUpdaterMO = autoUpdater as unknown as MockedObject<AppUpdater>;

    // Trigger 'checking-for-update' event
    const checkingForUpdateHandler = autoUpdaterMO.on.mock.calls.find(
      ([event]) => event === 'checking-for-update',
    );
    checkingForUpdateHandler && checkingForUpdateHandler[1]('' as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:checking-for-update');

    // // Trigger 'update-available' event
    const updateInfo = { version: '1.0.0' } as unknown as UpdateInfo;
    const updateAvailableHandler = autoUpdaterMO.on.mock.calls.find(
      ([event]) => event === 'update-available',
    );
    updateAvailableHandler && updateAvailableHandler[1](updateInfo as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:update-available', updateInfo);

    // // Trigger 'update-not-available' event
    const updateNotAvailableHandler = autoUpdaterMO.on.mock.calls.find(
      ([event]) => event === 'update-not-available',
    );
    updateNotAvailableHandler && updateNotAvailableHandler[1]('' as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:update-not-available');

    // // Trigger 'download-progress' event
    const progressInfo: ProgressInfo = {
      total: 100,
      delta: 2,
      transferred: 58,
      percent: 58,
      bytesPerSecond: 3,
    };
    const downloadProgressHandler = autoUpdaterMO.on.mock.calls.find(
      ([event]) => event === 'download-progress',
    );
    downloadProgressHandler && downloadProgressHandler[1](progressInfo as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:download-progress', progressInfo);

    // // Trigger 'update-downloaded' event
    const updateDownloadedHandler = autoUpdaterMO.on.mock.calls.find(
      ([event]) => event === 'update-downloaded',
    );
    updateDownloadedHandler && updateDownloadedHandler[1]('' as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:update-downloaded');

    // // Trigger 'error' event
    const error = new Error('error');
    const errorHandler = autoUpdaterMO.on.mock.calls.find(([event]) => event === 'error');
    errorHandler && errorHandler[1](error as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:error', error.message);
    error.cause = 'cause';
    errorHandler && errorHandler[1](error as any, '' as any);
    expect(window.webContents.send).toHaveBeenCalledWith('update:error', error.cause);
  });
});
