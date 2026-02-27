// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInstall = vi.fn();
const mockStartDownload = vi.fn();
const mockCancel = vi.fn();
const mockRemoveAllListeners = vi.fn();
const mockOnCheckingForUpdate = vi.fn();
const mockOnUpdateAvailable = vi.fn();
const mockOnUpdateNotAvailable = vi.fn();
const mockOnDownloadProgress = vi.fn();
const mockOnUpdateDownloaded = vi.fn();
const mockOnError = vi.fn();

// Mock the window.electronAPI before importing the composable
vi.stubGlobal('window', {
  electronAPI: {
    local: {
      update: {
        install: mockInstall,
        startDownload: mockStartDownload,
        cancel: mockCancel,
        removeAllListeners: mockRemoveAllListeners,
        onCheckingForUpdate: mockOnCheckingForUpdate,
        onUpdateAvailable: mockOnUpdateAvailable,
        onUpdateNotAvailable: mockOnUpdateNotAvailable,
        onDownloadProgress: mockOnDownloadProgress,
        onUpdateDownloaded: mockOnUpdateDownloaded,
        onError: mockOnError,
      },
    },
  },
});

// Mock onBeforeUnmount since we're not in a component context
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onBeforeUnmount: vi.fn(),
  };
});

import useElectronUpdater from '@renderer/composables/useElectronUpdater';

describe('useElectronUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installUpdate', () => {
    it('should set state to "installing" without calling the IPC install', () => {
      const { state, installUpdate } = useElectronUpdater();

      installUpdate();

      expect(state.value).toBe('installing');
      expect(mockInstall).not.toHaveBeenCalled();
    });
  });

  describe('confirmInstall', () => {
    it('should call window.electronAPI.local.update.install()', () => {
      const { confirmInstall } = useElectronUpdater();

      confirmInstall();

      expect(mockInstall).toHaveBeenCalledTimes(1);
    });
  });

  describe('installUpdate then confirmInstall flow', () => {
    it('should first set state to installing, then call IPC on confirm', () => {
      const { state, installUpdate, confirmInstall } = useElectronUpdater();

      // Step 1: installUpdate sets state but doesn't call IPC
      installUpdate();
      expect(state.value).toBe('installing');
      expect(mockInstall).not.toHaveBeenCalled();

      // Step 2: confirmInstall actually triggers the IPC call
      confirmInstall();
      expect(mockInstall).toHaveBeenCalledTimes(1);
    });
  });

  describe('startUpdate', () => {
    it('should not start update with empty URL', () => {
      const { startUpdate } = useElectronUpdater();

      startUpdate('');

      expect(mockStartDownload).not.toHaveBeenCalled();
    });

    it('should set state to checking and register listeners', () => {
      const { state, startUpdate } = useElectronUpdater();

      startUpdate('https://releases.example.com');

      expect(state.value).toBe('checking');
      expect(mockOnCheckingForUpdate).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnUpdateAvailable).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnUpdateNotAvailable).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnDownloadProgress).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnUpdateDownloaded).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Function));
      expect(mockStartDownload).toHaveBeenCalledWith('https://releases.example.com');
    });
  });

  describe('cancelUpdate', () => {
    it('should reset state to idle and remove listeners', () => {
      const { state, startUpdate, cancelUpdate } = useElectronUpdater();

      startUpdate('https://releases.example.com');
      expect(state.value).toBe('checking');

      cancelUpdate();

      expect(state.value).toBe('idle');
      expect(mockCancel).toHaveBeenCalled();
      expect(mockRemoveAllListeners).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { state, startUpdate, reset } = useElectronUpdater();

      startUpdate('https://releases.example.com');

      reset();

      expect(state.value).toBe('idle');
      expect(mockRemoveAllListeners).toHaveBeenCalled();
    });
  });
});
