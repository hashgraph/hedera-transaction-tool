import { ipcRenderer } from 'electron';
import { ProgressInfo, UpdateInfo } from 'electron-updater';

export default {
  update: {
    onCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('update:checking-for-update', () => callback());
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('update:error', (_e, error: string) => callback(error));
    },
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:update-available', (_e, info: UpdateInfo) => callback(info));
    },
    onUpdateNotAvailable: (callback: () => void) => {
      ipcRenderer.on('update:update-not-available', () => callback());
    },
    downloadUpdate: () => ipcRenderer.send('update:download-update'),
    onDownloadProgess: (callback: (info: ProgressInfo) => void) => {
      ipcRenderer.on('update:download-progress', (_e, info: ProgressInfo) => callback(info));
    },
    onUpdateDownloaded: (callback: () => void) => {
      ipcRenderer.on('update:update-downloaded', () => callback());
    },
    quitAndInstall: () => ipcRenderer.send('update:quit-install'),
  },
};
