import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {app, BrowserWindow, screen} from 'electron';

import {sendUpdateThemeEventTo} from '@main/modules/ipcHandlers/theme';

async function createWindow() {
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

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
  });

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    await mainWindow.loadURL(import.meta.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      fileURLToPath(new URL('./../../renderer/dist/index.html', import.meta.url)),
    );
  }

  return mainWindow;
}

export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();

  return window;
}
