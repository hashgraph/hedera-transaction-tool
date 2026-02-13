import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { ipcRenderer } from 'electron';

import type { UpdateError } from '@shared/interfaces/update';

export default {
  update: {
    onceCheckingForUpdateResult: (callback: (file: string | null) => void) => {
      ipcRenderer.once('update:check-for-update-result', (_e, file: string | null) =>
        callback(file),
      );
    },
    checkForUpdate: (location: string) => ipcRenderer.send('update:check-for-update', location),
    getVersion: (): Promise<string> => ipcRenderer.invoke('update:get-version'),

    onCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('update:checking-for-update', () => callback());
    },
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:update-available', (_e, info: UpdateInfo) => callback(info));
    },
    onUpdateNotAvailable: (callback: () => void) => {
      ipcRenderer.on('update:update-not-available', () => callback());
    },
    onDownloadProgress: (callback: (info: ProgressInfo) => void) => {
      ipcRenderer.on('update:download-progress', (_e, info: ProgressInfo) => callback(info));
    },
    onUpdateDownloaded: (callback: () => void) => {
      ipcRenderer.on('update:update-downloaded', () => callback());
    },
    onError: (callback: (error: UpdateError) => void) => {
      ipcRenderer.on('update:error', (_e, error: UpdateError) => callback(error));
    },
    startDownload: (updateUrl: string) => ipcRenderer.send('update:start-download', updateUrl),
    install: () => ipcRenderer.send('update:install'),
    cancel: () => ipcRenderer.send('update:cancel'),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('update:checking-for-update');
      ipcRenderer.removeAllListeners('update:update-available');
      ipcRenderer.removeAllListeners('update:update-not-available');
      ipcRenderer.removeAllListeners('update:download-progress');
      ipcRenderer.removeAllListeners('update:update-downloaded');
      ipcRenderer.removeAllListeners('update:error');
    },
  },
};
