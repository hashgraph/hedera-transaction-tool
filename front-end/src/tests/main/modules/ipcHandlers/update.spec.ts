import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, getIPCListener, invokeIPCHandler, invokeIPCListener } from '../../_utils_';

import registerUpdateListeners from '@main/modules/ipcHandlers/update';
import { app } from 'electron';
import { Updater } from '@main/services/update';
import { getUpdaterService } from '@main/services/electronUpdater';

vi.mock('@main/services/localUser/update', () => mockDeep());

// Create mock functions for the updater service
const mockCheckForUpdatesAndDownload = vi.fn().mockResolvedValue(undefined);
const mockDownloadUpdate = vi.fn().mockResolvedValue(undefined);
const mockQuitAndInstall = vi.fn();
const mockCancelUpdate = vi.fn();

// Mock the new electronUpdater service to avoid ESM import issues with electron-updater
vi.mock('@main/services/electronUpdater', () => ({
  getUpdaterService: vi.fn(() => ({
    checkForUpdatesAndDownload: mockCheckForUpdatesAndDownload,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
    cancelUpdate: mockCancelUpdate,
  })),
  initializeUpdaterService: vi.fn(),
}));

describe('registerUpdateListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mock implementations
    mockCheckForUpdatesAndDownload.mockResolvedValue(undefined);
    mockDownloadUpdate.mockResolvedValue(undefined);
    // Re-setup the mock to return the service
    vi.mocked(getUpdaterService).mockReturnValue({
      checkForUpdatesAndDownload: mockCheckForUpdatesAndDownload,
      downloadUpdate: mockDownloadUpdate,
      quitAndInstall: mockQuitAndInstall,
      cancelUpdate: mockCancelUpdate,
    } as ReturnType<typeof getUpdaterService>);
    registerUpdateListeners();
  });

  test('Should register handlers for each update event', () => {
    const onEventNames = ['check-for-update', 'start-download', 'install', 'cancel'];
    const handleEventNames = ['get-version'];

    expect(onEventNames.every(util => getIPCListener(`update:${util}`))).toBe(true);
    expect(handleEventNames.every(util => getIPCHandler(`update:${util}`))).toBe(true);
  });

  test('Should start checking for updates', async () => {
    vi.spyOn(Updater, 'checkForUpdate');

    await invokeIPCListener('update:check-for-update');

    expect(Updater.checkForUpdate).toBeCalledTimes(1);
  });

  test('Should get version', async () => {
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');

    const result = await invokeIPCHandler('update:get-version');

    expect(result).toBe('1.0.0');
  });

  describe('electron-updater integration', () => {
    test('Should call checkForUpdatesAndDownload when start-download is called', async () => {
      await invokeIPCListener('update:start-download', 'https://releases.example.com');

      // Should call checkForUpdatesAndDownload which handles both checking and downloading
      // Download will only happen if update is available (event-driven)
      expect(mockCheckForUpdatesAndDownload).toHaveBeenCalledWith('https://releases.example.com');
      // downloadUpdate should NOT be called directly - only via event handler when update is available
      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    test('Should not start download when updater service is null', async () => {
      vi.mocked(getUpdaterService).mockReturnValue(null);

      await invokeIPCListener('update:start-download', 'https://releases.example.com');

      expect(mockCheckForUpdatesAndDownload).not.toHaveBeenCalled();
      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    test('Should install update when install is called', async () => {
      await invokeIPCListener('update:install');

      expect(mockQuitAndInstall).toHaveBeenCalled();
    });

    test('Should not install when updater service is null', async () => {
      vi.mocked(getUpdaterService).mockReturnValue(null);

      await invokeIPCListener('update:install');

      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });

    test('Should cancel update when cancel is called', async () => {
      await invokeIPCListener('update:cancel');

      expect(mockCancelUpdate).toHaveBeenCalled();
    });

    test('Should not cancel when updater service is null', async () => {
      vi.mocked(getUpdaterService).mockReturnValue(null);

      await invokeIPCListener('update:cancel');

      expect(mockCancelUpdate).not.toHaveBeenCalled();
    });
  });
});
