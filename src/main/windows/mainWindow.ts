import { BrowserWindow, screen } from 'electron';
import { is } from '@electron-toolkit/utils';
import { join } from 'path';
import { sendUpdateThemeEventTo } from '../modules/ipcHandlers/theme';
import icon from '../../../resources/icon.png?asset';

export default function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    ...(process.platform === 'linux' ? { icon } : {}),
    width: Math.round(width * 0.9),
    height: Math.round(height * 0.9),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
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
