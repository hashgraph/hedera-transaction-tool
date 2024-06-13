import { join } from 'path';

import { BrowserWindow, screen } from 'electron';

import { removeListeners, sendUpdateThemeEventTo } from '@main/modules/ipcHandlers/theme';

async function createWindow() {
  process.env.DIST_ELECTRON = join(__dirname, '..');
  process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
  process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST;

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
      sandbox: false,
      partition: 'persist:main',
    },
    show: false,
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      console.log('emit');

      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    removeListeners();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'));
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
