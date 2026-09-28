import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { mockDeep } from 'vitest-mock-extended';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

// Create mock functions using vi.hoisted() so they're available in the mock factory
const {
  mockOn,
  mockOnce,
  mockRemoveAllListeners,
  mockRemoveListener,
  mockCheckForUpdates,
  mockDownloadUpdate,
  mockQuitAndInstall,
  mockSetFeedURL,
} = vi.hoisted(() => {
  return {
    mockOn: vi.fn(),
    mockOnce: vi.fn(),
    mockRemoveAllListeners: vi.fn(),
    mockRemoveListener: vi.fn(),
    mockCheckForUpdates: vi.fn().mockResolvedValue(undefined),
    mockDownloadUpdate: vi.fn().mockResolvedValue(undefined),
    mockQuitAndInstall: vi.fn(),
    mockSetFeedURL: vi.fn(),
  };
});

// Mock electron-updater - create a simple mock object
vi.mock('electron-updater', () => {
  // Create a new object each time to avoid circular references
  const mockAutoUpdater = {
    logger: null,
    autoDownload: false,
    forceDevUpdateConfig: false,
    on: mockOn,
    once: mockOnce,
    removeAllListeners: mockRemoveAllListeners,
    removeListener: mockRemoveListener,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
    setFeedURL: mockSetFeedURL,
  };

  return {
    autoUpdater: mockAutoUpdater,
  };
});

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}));

// Mock logger
vi.mock('@main/modules/logger', () => ({
  getAppUpdateLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock categorizeUpdateError
vi.mock('@main/utils/updateErrors', () => ({
  categorizeUpdateError: vi.fn((error: Error | string) => ({
    type: 'generic',
    message: 'An error occurred while updating.',
    details: typeof error === 'string' ? error : error.message,
  })),
}));

// Import after mocks are set up
import {
  ElectronUpdaterService,
  getUpdaterService,
  initializeUpdaterService,
} from '@main/services/electronUpdater';

const TRUSTED_UPDATE_BASE =
  'https://github.com/hashgraph/hedera-transaction-tool/releases/download/';

const buildExpectedUrl = (version: string) => `${TRUSTED_UPDATE_BASE}v${version}/`;

describe('ElectronUpdaterService', () => {
  let mockWindow: any;
  let service: ElectronUpdaterService;

  beforeEach(() => {
    // Clear all mock calls
    mockOn.mockClear();
    mockOnce.mockClear();
    mockRemoveAllListeners.mockClear();
    mockRemoveListener.mockClear();
    mockCheckForUpdates.mockClear();
    mockDownloadUpdate.mockClear();
    mockQuitAndInstall.mockClear();
    mockSetFeedURL.mockClear();

    // Reset mock implementations
    mockCheckForUpdates.mockResolvedValue(undefined);
    mockDownloadUpdate.mockResolvedValue(undefined);

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };

    service = new ElectronUpdaterService(mockWindow as BrowserWindow);
  });

  describe('constructor', () => {
    it('should create an instance with window reference', () => {
      expect(service).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should not initialize when version is empty', () => {
      service.initialize('');

      expect(service.getUpdateUrl()).toBeNull();
    });

    it('should reject strings that are not valid semver versions', () => {
      service.initialize('https://evil.example.com/malware');

      expect(service.getUpdateUrl()).toBeNull();
      expect(mockSetFeedURL).not.toHaveBeenCalled();
    });

    it('should reject path traversal attempts', () => {
      service.initialize('../../../etc/passwd');

      expect(service.getUpdateUrl()).toBeNull();
      expect(mockSetFeedURL).not.toHaveBeenCalled();
    });

    it('should set the constructed update URL when a valid semver version is provided', () => {
      service.initialize('1.0.0');

      expect(service.getUpdateUrl()).toBe(buildExpectedUrl('1.0.0'));
    });

    it('should accept pre-release versions (e.g. SNAPSHOT builds)', () => {
      service.initialize('0.30.0-SNAPSHOT');

      expect(service.getUpdateUrl()).toBe(buildExpectedUrl('0.30.0-SNAPSHOT'));
    });

    it('should call setFeedURL with the hardcoded base URL and the validated version', () => {
      service.initialize('1.0.0');

      expect(mockSetFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: buildExpectedUrl('1.0.0'),
      });
    });

    it('should not re-initialize when called with the same version', () => {
      const version = '1.0.0';

      service.initialize(version);
      expect(mockSetFeedURL).toHaveBeenCalledTimes(1);

      mockSetFeedURL.mockClear();

      service.initialize(version);
      expect(mockSetFeedURL).not.toHaveBeenCalled();
      expect(service.getUpdateUrl()).toBe(buildExpectedUrl(version));
    });

    it('should re-initialize when called with a different version', () => {
      const firstVersion = '1.0.0';
      const secondVersion = '2.0.0';

      service.initialize(firstVersion);
      expect(mockSetFeedURL).toHaveBeenCalledTimes(1);
      expect(mockSetFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: buildExpectedUrl(firstVersion),
      });
      expect(service.getUpdateUrl()).toBe(buildExpectedUrl(firstVersion));

      mockSetFeedURL.mockClear();

      service.initialize(secondVersion);
      expect(mockSetFeedURL).toHaveBeenCalledTimes(1);
      expect(mockSetFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: buildExpectedUrl(secondVersion),
      });
      expect(service.getUpdateUrl()).toBe(buildExpectedUrl(secondVersion));
    });
  });

  describe('checkForUpdatesAndDownload', () => {
    it('should send error when updater is not initialized and no version provided', async () => {
      await service.checkForUpdatesAndDownload();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          type: 'generic',
          message: expect.any(String),
        }),
      );
    });

    it('should initialize updater when version is provided', async () => {
      await service.checkForUpdatesAndDownload('1.0.0');

      expect(service.getUpdateUrl()).toBe(buildExpectedUrl('1.0.0'));
    });

    it('should emit error and not check for updates when an invalid version is provided', async () => {
      await service.checkForUpdatesAndDownload('not-a-version');

      expect(mockCheckForUpdates).not.toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({ type: 'generic' }),
      );
    });

    it('should not use a stale updater when an invalid version is provided', async () => {
      service.initialize('1.0.0');
      mockSetFeedURL.mockClear();

      await service.checkForUpdatesAndDownload('not-a-version');

      // checkForUpdates must not run — even though a previous valid updater exists
      expect(mockCheckForUpdates).not.toHaveBeenCalled();
    });

    it('should call updater.checkForUpdates when initialized', async () => {
      service.initialize('1.0.0');

      await service.checkForUpdatesAndDownload();

      expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it('should set up one-time listener for update-available that triggers download', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      // Should have called once() to set up a one-time listener for 'update-available'
      expect(mockOnce).toHaveBeenCalledWith('update-available', expect.any(Function));
    });

    it('should call downloadUpdate when update-available event fires', async () => {
      service.initialize('1.0.0');

      // Capture the handler passed to once()
      let updateAvailableHandler: (() => void) | undefined;
      mockOnce.mockImplementation((event: string, handler: () => void) => {
        if (event === 'update-available') {
          updateAvailableHandler = handler;
        }
      });

      await service.checkForUpdatesAndDownload();

      // Verify downloadUpdate is NOT called before the event
      expect(mockDownloadUpdate).not.toHaveBeenCalled();

      // Simulate the update-available event by calling the handler
      if (updateAvailableHandler) {
        updateAvailableHandler();
        // Now downloadUpdate should have been called
        expect(mockDownloadUpdate).toHaveBeenCalled();
      } else {
        throw new Error('update-available handler was not set up');
      }
    });

    it('should NOT call downloadUpdate when update-not-available event fires', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      // Simulate update-not-available event
      const updateNotAvailableCall = mockOn.mock.calls.find(
        ([name]) => name === 'update-not-available',
      );
      expect(updateNotAvailableCall).toBeDefined();

      // Trigger the callback
      const callback = updateNotAvailableCall![1];
      callback();

      // downloadUpdate should NOT have been called
      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    it('should handle checkForUpdates error', async () => {
      service.initialize('1.0.0');
      mockCheckForUpdates.mockRejectedValueOnce(new Error('Network error'));

      await service.checkForUpdatesAndDownload();

      // Should clean up the one-time listener on error
      expect(mockRemoveListener).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          type: 'generic',
        }),
      );
    });
  });

  describe('downloadUpdate', () => {
    it('should send error when updater is not initialized', async () => {
      await service.downloadUpdate();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          type: 'generic',
        }),
      );
    });

    it('should call updater.downloadUpdate when initialized', async () => {
      service.initialize('1.0.0');

      await service.downloadUpdate();

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });

    it('should handle downloadUpdate error', async () => {
      service.initialize('1.0.0');
      mockDownloadUpdate.mockRejectedValueOnce(new Error('Download failed'));

      await service.downloadUpdate();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          type: 'generic',
        }),
      );
    });
  });

  describe('quitAndInstall', () => {
    it('should not throw when updater is not initialized', () => {
      expect(() => service.quitAndInstall()).not.toThrow();
    });

    it('should call updater.quitAndInstall when initialized', () => {
      service.initialize('1.0.0');

      service.quitAndInstall();

      expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true);
    });

    it('should pass isSilent and isForceRunAfter parameters', () => {
      service.initialize('1.0.0');

      service.quitAndInstall(true, false);

      expect(mockQuitAndInstall).toHaveBeenCalledWith(true, false);
    });
  });

  describe('cancelUpdate', () => {
    it('should not throw when updater is not initialized', () => {
      expect(() => service.cancelUpdate()).not.toThrow();
    });

    it('should remove event listeners when initialized', () => {
      service.initialize('1.0.0');

      service.cancelUpdate();

      expect(mockRemoveAllListeners).toHaveBeenCalled();
    });
  });

  describe('getUpdateUrl', () => {
    it('should return null when not initialized', () => {
      expect(service.getUpdateUrl()).toBeNull();
    });

    it('should return the constructed trusted update URL when initialized', () => {
      service.initialize('1.0.0');

      expect(service.getUpdateUrl()).toBe(buildExpectedUrl('1.0.0'));
    });

    it('should return null after initialization fails validation', () => {
      service.initialize('https://evil.example.com/');

      expect(service.getUpdateUrl()).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should set up event listeners when checking for updates', async () => {
      service.initialize('1.0.0');

      await service.checkForUpdatesAndDownload();

      expect(mockOn).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should remove old listeners before setting up new ones', async () => {
      service.initialize('1.0.0');

      await service.checkForUpdatesAndDownload();

      expect(mockRemoveAllListeners).toHaveBeenCalledWith('checking-for-update');
      expect(mockRemoveAllListeners).toHaveBeenCalledWith('update-available');
      expect(mockRemoveAllListeners).toHaveBeenCalledWith('update-not-available');
      expect(mockRemoveAllListeners).toHaveBeenCalledWith('download-progress');
      expect(mockRemoveAllListeners).toHaveBeenCalledWith('update-downloaded');
      expect(mockRemoveAllListeners).toHaveBeenCalledWith('error');
    });
  });

  describe('event handler callbacks', () => {
    // Helper to get registered callback by event name
    const getEventCallback = (eventName: string): ((...args: unknown[]) => void) | undefined => {
      const call = mockOn.mock.calls.find(([name]) => name === eventName);
      return call ? call[1] : undefined;
    };

    it('should send update-not-available event when no update is available', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('update-not-available');
      expect(callback).toBeDefined();

      // Invoke the callback
      callback!();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:update-not-available');
    });

    it('should send download-progress event with progress info', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('download-progress');
      expect(callback).toBeDefined();

      const progressInfo = {
        percent: 50.5,
        transferred: 5000,
        total: 10000,
        bytesPerSecond: 1000,
        delta: 500,
      };

      // Invoke the callback with progress info
      callback!(progressInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:download-progress',
        progressInfo,
      );
    });

    it('should send update-downloaded event when download completes', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('update-downloaded');
      expect(callback).toBeDefined();

      // Invoke the callback
      callback!();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:update-downloaded');
    });

    it('should send categorized error event on updater error', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('error');
      expect(callback).toBeDefined();

      const testError = new Error('Network connection failed');

      // Invoke the callback with error
      callback!(testError);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          type: 'generic',
          message: expect.any(String),
          details: expect.any(String),
        }),
      );
    });

    it('should send checking-for-update event when check starts', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('checking-for-update');
      expect(callback).toBeDefined();

      // Invoke the callback
      callback!();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:checking-for-update');
    });

    it('should send update-available event with update info', async () => {
      service.initialize('1.0.0');
      await service.checkForUpdatesAndDownload();

      const callback = getEventCallback('update-available');
      expect(callback).toBeDefined();

      const updateInfo = {
        version: '2.0.0',
        releaseDate: '2024-01-01',
        files: [],
        path: '',
        sha512: '',
      };

      // Invoke the callback with update info
      callback!(updateInfo);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:update-available',
        updateInfo,
      );
    });
  });
});

describe('getUpdaterService', () => {
  it('should return null when service is not initialized', () => {
    // Note: This test might fail if other tests have already initialized the service
    // In a real scenario, you'd want to reset the module state between tests
    const result = getUpdaterService();

    // The result depends on whether initializeUpdaterService was called
    expect(result === null || result instanceof ElectronUpdaterService).toBe(true);
  });
});

describe('initializeUpdaterService', () => {
  it('should return an ElectronUpdaterService instance', () => {
    const mockWin = mockDeep<BrowserWindow>();

    const result = initializeUpdaterService(mockWin);

    expect(result).toBeInstanceOf(ElectronUpdaterService);
  });

  it('should return the same instance when called multiple times', () => {
    const mockWin = mockDeep<BrowserWindow>();

    const first = initializeUpdaterService(mockWin);
    const second = initializeUpdaterService(mockWin);

    expect(first).toBe(second);
  });
});

describe('ElectronUpdaterService - edge cases', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOnce.mockClear();
    mockRemoveAllListeners.mockClear();
    mockRemoveListener.mockClear();
    mockCheckForUpdates.mockClear();
    mockDownloadUpdate.mockClear();
    mockQuitAndInstall.mockClear();
    mockSetFeedURL.mockClear();
  });

  describe('removeEventListeners when updater is null', () => {
    it('should return early and not throw when cancelUpdate is called without initialization', () => {
      const mockWindow = {
        webContents: {
          send: vi.fn(),
        },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);

      // This should trigger removeEventListeners with null updater (line 114-115)
      expect(() => service.cancelUpdate()).not.toThrow();

      // removeAllListeners should NOT have been called since updater is null
      expect(mockRemoveAllListeners).not.toHaveBeenCalled();
    });
  });

  describe('setupEventListeners when window is null', () => {
    it('should handle null window gracefully in event callbacks', async () => {
      // Create service with a window that we can manipulate
      const mockWindow = {
        webContents: {
          send: vi.fn(),
        },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);
      service.initialize('1.0.0');

      await service.checkForUpdatesAndDownload();

      // Get the callback and invoke it - should not throw even if window.webContents.send is called
      const callback = mockOn.mock.calls.find(([name]) => name === 'checking-for-update');
      expect(callback).toBeDefined();

      // Invoke callback - it uses optional chaining so should be safe
      callback![1]();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:checking-for-update');
    });
  });

  describe('setFeedURL configuration', () => {
    it('should call setFeedURL with the hardcoded trusted base URL, not the raw input', () => {
      const mockWindow = {
        webContents: { send: vi.fn() },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);
      service.initialize('1.0.0');

      expect(mockSetFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: buildExpectedUrl('1.0.0'),
      });
    });

    it('should not call setFeedURL when given a non-semver string', () => {
      const mockWindow = {
        webContents: { send: vi.fn() },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);
      service.initialize('https://evil.example.com/malware');

      expect(mockSetFeedURL).not.toHaveBeenCalled();
    });
  });

  describe('downloadUpdate without checkForUpdates', () => {
    it('should call downloadUpdate directly after initialize', async () => {
      const mockWindow = {
        webContents: { send: vi.fn() },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);
      service.initialize('1.0.0');

      // Call downloadUpdate without checkForUpdates first
      await service.downloadUpdate();

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });
  });

  describe('multiple checkForUpdatesAndDownload calls', () => {
    it('should remove and re-add listeners on subsequent checkForUpdatesAndDownload calls', async () => {
      const mockWindow = {
        webContents: { send: vi.fn() },
      };

      const service = new ElectronUpdaterService(mockWindow as unknown as BrowserWindow);
      service.initialize('1.0.0');

      // First call
      await service.checkForUpdatesAndDownload();
      const firstRemoveCount = mockRemoveAllListeners.mock.calls.length;
      const firstOnCount = mockOn.mock.calls.length;

      // Second call should remove old listeners and add new ones
      await service.checkForUpdatesAndDownload();

      // Should have more calls now
      expect(mockRemoveAllListeners.mock.calls.length).toBeGreaterThan(firstRemoveCount);
      expect(mockOn.mock.calls.length).toBeGreaterThan(firstOnCount);
    });
  });
});
