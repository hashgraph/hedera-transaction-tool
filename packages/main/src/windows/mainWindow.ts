import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {app, BrowserWindow, screen} from 'electron';
import {is} from '@electron-toolkit/utils';

import {sendUpdateThemeEventTo} from '@main/modules/ipcHandlers/theme';

export default async function createWindow() {
  const {width, height} = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    width: Math.round(width * 0.9),
    height: Math.round(height * 0.9),
    minWidth: 960,
    minHeight: 400,
    webPreferences: {
      preload: join(app.getAppPath(), 'packages/preload/dist/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  /* main window web contents' events */
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (is.dev && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    await mainWindow.loadURL(import.meta.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      fileURLToPath(new URL('./../../renderer/dist/index.html', import.meta.url)),
    );
  }

  return mainWindow;
}
