import { join } from 'path';
import { BrowserWindow } from 'electron';
import { sendUpdateThemeEventTo } from '../modules/ipcHandlers/theme';

export default function createWindow(app: Electron.App) {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    const rendererPort = process.argv[2];
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
  }

  /* main window web contents' events */
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
    mainWindow.setFullScreen(true);
  });

  return mainWindow;
}
