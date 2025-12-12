import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { ipcRenderer } from 'electron';

export default {
  update: {
    onCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('update:checking-for-update', () => callback());
    },
    onError: (callback: (error: { message: string; cause?: any; stack?: string }) => void) => {
      ipcRenderer.on('update:error', (_e, error) => callback(error));
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
    downloadUpdate: () => ipcRenderer.send('update:download-update'),
    quitAndInstall: () => ipcRenderer.send('update:quit-install'),
    checkForUpdates: () => ipcRenderer.send('update:check-for-updates'),
    getVerison: (): Promise<string> => ipcRenderer.invoke('update:get-version'),
  },
};
