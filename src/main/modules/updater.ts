import { BrowserWindow, ipcMain } from 'electron';
import { ProgressInfo, autoUpdater } from 'electron-updater';

import { getAppUpdateLogger } from './logger';

/* Enable logging */
autoUpdater.logger = getAppUpdateLogger();

autoUpdater.autoDownload = false;

export default function (window: BrowserWindow) {
  /* Checking For Update  */
  autoUpdater.on('checking-for-update', () => {
    window.webContents.send('update:checking-for-update');
  });

  /* Update Available */
  autoUpdater.on('update-available', async info => {
    window.webContents.send('update:update-available', info);
  });
  ipcMain.on('update:download-update', () => autoUpdater.downloadUpdate());

  /* Update Not Available */
  autoUpdater.on('update-not-available', () =>
    window.webContents.send('update:update-not-available'),
  );

  /* Downloading Progess */
  autoUpdater.on('download-progress', async (info: ProgressInfo) => {
    window.webContents.send('update:download-progress', info);
  });

  /* Update Downloaded */
  autoUpdater.on('update-downloaded', async () => {
    window.webContents.send('update:update-downloaded');
  });

  /* Install And Restart */
  ipcMain.on('update:quit-install', () => autoUpdater.quitAndInstall(false, true));

  /* Error */
  autoUpdater.on('error', error => {
    // logger.error(error.message);
    window.webContents.send('update:error', error.cause || error.message);
  });

  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.checkForUpdates();
}
