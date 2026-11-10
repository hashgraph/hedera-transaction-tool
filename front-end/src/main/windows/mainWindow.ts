import { join } from 'path';

import { BrowserWindow, screen, session as ses } from 'electron';

import { removeListeners, sendUpdateThemeEventTo } from '@main/modules/ipcHandlers/theme';
import { getWindowBounds, setWindowBounds } from '@main/services/windowState';
import { getSessionPartitionName } from '@main/utils/playwrightIsolation';

async function createWindow() {
  process.env.DIST_ELECTRON = join(__dirname, '..');
  process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
  process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST;

  const preload = join(__dirname, '../preload/index.js');
  const session = ses.fromPartition(getSessionPartitionName());

  const storedBounds = await getWindowBounds();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    width: storedBounds ? storedBounds.width : Math.round(width * 0.9),
    height: storedBounds ? storedBounds.height : Math.round(height * 0.9),
    x: storedBounds ? storedBounds.x : undefined,
    y: storedBounds ? storedBounds.y : undefined,
    minWidth: 960,
    minHeight: 750,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      session,
    },
    show: false,
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
  });

  mainWindow.on('resized', async () => {
    await setWindowBounds(mainWindow);
  });

  mainWindow.on('moved', async () => {
    await setWindowBounds(mainWindow);
  });

  mainWindow.on('closed', () => {
    removeListeners();
  });

  mainWindow.webContents.on('will-navigate', (event, _url) => {
    // TT does not navigate out of its index.html : so this callback is not called.
    // But we disable it because it's recommended by security audits.
    // https://www.electronjs.org/docs/latest/api/web-contents#event-will-navigate
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    // TT uses only one window : so this callback is not called.
    // But we disable it because it's recommended by security audits.
    // If someday TT supports multiple windows, we should probably revisit this code.
    // https://www.electronjs.org/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(join(process.env.DIST, 'index.html'));
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
