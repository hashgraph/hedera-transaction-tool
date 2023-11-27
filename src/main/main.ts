import { app, BrowserWindow, session } from 'electron';
import { join, resolve } from 'path';
import dotenv from 'dotenv';

import createMenu from './modules/menu';
import addTheme from './modules/theme';
import listenForConfigurationEvents from './modules/configuration';
import listenForRecoveryPhraseEvents from './modules/recoveryPhrase';

dotenv.config({
  path: app.isPackaged ? join(process.resourcesPath, '.env') : resolve(process.cwd(), '.env'),
  override: true,
});

const { sendUpdateThemeEventTo } = addTheme();
listenForConfigurationEvents();
listenForRecoveryPhraseEvents(app);

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
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

  /* window events */

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  /* window web contents' events */
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      sendUpdateThemeEventTo(mainWindow);
    }

    mainWindow?.show();
  });
}

app.on('ready', () => {
  createMenu();

  createWindow();

  if (process.env.NODE_ENV === 'production') {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["script-src 'self'"],
        },
      });
    });
  }

  app.on('activate', function () {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
