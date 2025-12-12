import { BrowserWindow, ipcMain } from 'electron';
import { ProgressInfo, UpdateInfo, autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

import { getAppUpdateLogger } from './logger';

autoUpdater.logger = getAppUpdateLogger();

autoUpdater.autoDownload = false;

if (is.dev) {
  autoUpdater.forceDevUpdateConfig = true;
}

export default function (window: BrowserWindow) {
  autoUpdater.on('checking-for-update', () => {
    window.webContents.send('update:checking-for-update');
  });

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    window.webContents.send('update:update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    window.webContents.send('update:update-not-available');
  });

  autoUpdater.on('download-progress', async (info: ProgressInfo) => {
    window.webContents.send('update:download-progress', info);
  });

  autoUpdater.on('update-downloaded', async () => {
    window.webContents.send('update:update-downloaded');
  });

  autoUpdater.on('error', error => {
    window.webContents.send('update:error', {
      message: error.message,
      cause: error.cause,
      ...(is.dev && { stack: error.stack }),
    });
  });

  ipcMain.on('update:download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('update:quit-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.on('update:check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  autoUpdater.checkForUpdates();
}
