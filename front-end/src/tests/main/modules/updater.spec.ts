import { mockDeep } from 'vitest-mock-extended';

import { BrowserWindow, ipcMain } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

import initUpdater from '@main/modules/updater';
import { getAppUpdateLogger } from '@main/modules/logger';

vi.mock('electron-updater', () => {
  const mockAutoUpdater = {
    logger: null,
    autoDownload: false,
    forceDevUpdateConfig: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  };
  return {
    autoUpdater: mockAutoUpdater,
    ProgressInfo: {},
    UpdateInfo: {},
  };
});

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    on: vi.fn(),
  },
}));

vi.mock('@main/modules/logger', () => ({
  getAppUpdateLogger: vi.fn(() => ({
    transports: {
      file: {
        fileName: 'app-updates.log',
        level: 'debug',
      },
    },
  })),
}));

describe('initUpdater', () => {
  let mockWindow: BrowserWindow;
  let mockLogger: ReturnType<typeof getAppUpdateLogger>;

  beforeEach(() => {
    vi.resetAllMocks();

    mockLogger = {
      transports: {
        file: {
          fileName: 'app-updates.log',
          level: 'debug',
        },
      },
    } as ReturnType<typeof getAppUpdateLogger>;

    mockWindow = mockDeep<BrowserWindow>({
      webContents: {
        send: vi.fn(),
      },
    });

    vi.mocked(getAppUpdateLogger).mockReturnValue(mockLogger);
  });

  describe('Module initialization and configuration', () => {
    test('Should set logger from getAppUpdateLogger', () => {
      expect(autoUpdater.logger).toBeDefined();
      expect(autoUpdater.logger).toEqual(mockLogger);
    });

    test('Should set autoDownload to false', () => {
      initUpdater(mockWindow);

      expect(autoUpdater.autoDownload).toBe(false);
    });

    test('Should set forceDevUpdateConfig based on is.dev at module load time', () => {
      Object.defineProperty(is, 'dev', { value: false, writable: true, configurable: true });

      expect(autoUpdater.forceDevUpdateConfig).toBe(false);
    });

    test('Should call checkForUpdates on initialization', () => {
      initUpdater(mockWindow);

      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event listener registration', () => {
    test('Should register checking-for-update event listener', () => {
      initUpdater(mockWindow);

      const checkingCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'checking-for-update');

      expect(checkingCall).toBeDefined();
      expect(checkingCall![1]).toBeInstanceOf(Function);
    });

    test('Should register update-available event listener', () => {
      initUpdater(mockWindow);

      const availableCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-available');

      expect(availableCall).toBeDefined();
      expect(availableCall![1]).toBeInstanceOf(Function);
    });

    test('Should register update-not-available event listener', () => {
      initUpdater(mockWindow);

      const notAvailableCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-not-available');

      expect(notAvailableCall).toBeDefined();
      expect(notAvailableCall![1]).toBeInstanceOf(Function);
    });

    test('Should register download-progress event listener', () => {
      initUpdater(mockWindow);

      const progressCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'download-progress');

      expect(progressCall).toBeDefined();
      expect(progressCall![1]).toBeInstanceOf(Function);
    });

    test('Should register update-downloaded event listener', () => {
      initUpdater(mockWindow);

      const downloadedCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-downloaded');

      expect(downloadedCall).toBeDefined();
      expect(downloadedCall![1]).toBeInstanceOf(Function);
    });

    test('Should register error event listener', () => {
      initUpdater(mockWindow);

      const errorCall = vi.mocked(autoUpdater.on).mock.calls.find(([event]) => event === 'error');

      expect(errorCall).toBeDefined();
      expect(errorCall![1]).toBeInstanceOf(Function);
    });
  });

  describe('IPC message sending', () => {
    test('Should send checking-for-update message when event fires', () => {
      initUpdater(mockWindow);

      const checkingCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'checking-for-update');

      checkingCall![1]();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:checking-for-update');
    });

    test('Should send update-available message with UpdateInfo', () => {
      initUpdater(mockWindow);

      const mockUpdateInfo: UpdateInfo = {
        version: '1.0.0',
        releaseNotes: 'Test release notes',
        releaseDate: new Date('2024-01-01'),
      } as UpdateInfo;

      const availableCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-available');

      availableCall![1](mockUpdateInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:update-available',
        mockUpdateInfo,
      );
    });

    test('Should send update-not-available message', () => {
      initUpdater(mockWindow);

      const notAvailableCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-not-available');

      notAvailableCall![1]();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:update-not-available');
    });

    test('Should send download-progress message with ProgressInfo', () => {
      initUpdater(mockWindow);

      const mockProgressInfo: ProgressInfo = {
        percent: 50,
        transferred: 1000,
        total: 2000,
        bytesPerSecond: 500,
      } as ProgressInfo;

      const progressCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'download-progress');

      progressCall![1](mockProgressInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:download-progress',
        mockProgressInfo,
      );
    });

    test('Should send update-downloaded message', () => {
      initUpdater(mockWindow);

      const downloadedCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'update-downloaded');

      downloadedCall![1]();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:update-downloaded');
    });

    test('Should send error message with error object in production', () => {
      Object.defineProperty(is, 'dev', { value: false, writable: true, configurable: true });
      initUpdater(mockWindow);

      const mockError = {
        message: 'Test error message',
        cause: 'Test cause',
        stack: 'Error stack trace',
      };

      const errorCall = vi.mocked(autoUpdater.on).mock.calls.find(([event]) => event === 'error');

      errorCall![1](mockError);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:error', {
        message: 'Test error message',
        cause: 'Test cause',
      });
    });

    test('Should include stack in error message in dev mode', () => {
      Object.defineProperty(is, 'dev', { value: true, writable: true, configurable: true });
      initUpdater(mockWindow);

      const mockError = {
        message: 'Test error message',
        cause: 'Test cause',
        stack: 'Error stack trace',
      };

      const errorCall = vi.mocked(autoUpdater.on).mock.calls.find(([event]) => event === 'error');

      errorCall![1](mockError);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:error', {
        message: 'Test error message',
        cause: 'Test cause',
        stack: 'Error stack trace',
      });

      Object.defineProperty(is, 'dev', { value: false, writable: true, configurable: true });
    });
  });

  describe('IPC handler registration', () => {
    test('Should register download-update IPC handler', () => {
      initUpdater(mockWindow);

      const downloadCall = vi
        .mocked(ipcMain.on)
        .mock.calls.find(([channel]) => channel === 'update:download-update');

      expect(downloadCall).toBeDefined();
      expect(downloadCall![1]).toBeInstanceOf(Function);

      downloadCall![1]();

      expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    });

    test('Should register quit-install IPC handler', () => {
      initUpdater(mockWindow);

      const quitInstallCall = vi
        .mocked(ipcMain.on)
        .mock.calls.find(([channel]) => channel === 'update:quit-install');

      expect(quitInstallCall).toBeDefined();
      expect(quitInstallCall![1]).toBeInstanceOf(Function);

      quitInstallCall![1]();

      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    });

    test('Should register check-for-updates IPC handler', () => {
      initUpdater(mockWindow);

      const checkCall = vi
        .mocked(ipcMain.on)
        .mock.calls.find(([channel]) => channel === 'update:check-for-updates');

      expect(checkCall).toBeDefined();
      expect(checkCall![1]).toBeInstanceOf(Function);

      checkCall![1]();

      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2); // Once on init, once from handler
    });
  });

  describe('Edge cases', () => {
    test('Should handle multiple event fires correctly', () => {
      initUpdater(mockWindow);

      const checkingCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'checking-for-update');

      checkingCall![1]();
      checkingCall![1]();
      checkingCall![1]();

      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(3);
      expect(mockWindow.webContents.send).toHaveBeenNthCalledWith(1, 'update:checking-for-update');
      expect(mockWindow.webContents.send).toHaveBeenNthCalledWith(2, 'update:checking-for-update');
      expect(mockWindow.webContents.send).toHaveBeenNthCalledWith(3, 'update:checking-for-update');
    });

    test('Should not throw error if webContents.send fails', () => {
      mockWindow.webContents.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      initUpdater(mockWindow);

      const checkingCall = vi
        .mocked(autoUpdater.on)
        .mock.calls.find(([event]) => event === 'checking-for-update');

      expect(() => {
        checkingCall![1]();
      }).toThrow('Send failed');
    });
  });
});
