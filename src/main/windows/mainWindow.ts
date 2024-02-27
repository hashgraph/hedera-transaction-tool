import { join } from 'path';

import { BrowserWindow, screen } from 'electron';

import { sendUpdateThemeEventTo } from '@main/modules/ipcHandlers/theme';

export default function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const preload = join(__dirname, '../preload/index.js');

  const mainWindow = new BrowserWindow({
    width: Math.round(width * 0.9),
    height: Math.round(height * 0.9),
    minWidth: 960,
    minHeight: 400,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'));
  }

  /* main window web contents' events */
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
  });

  return mainWindow;
}
