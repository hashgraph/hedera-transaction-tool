import { app, BrowserWindow, session } from 'electron';
import { optimizer, is } from '@electron-toolkit/utils';

import initDatabase from './db';

import initLogger from './modules/logger';
import createMenu from './modules/menu';
import registerIpcListeners from './modules/ipcHandlers';

import createWindow from './windows/mainWindow';

let mainWindow: BrowserWindow | null;

initLogger();

run();

async function run() {
  await initDatabase();

  registerIpcListeners();
}

attachAppEvents();

function attachAppEvents() {
  app.on('ready', () => {
    mainWindow = createWindow();

    createMenu(mainWindow);

    /* main window events */
    mainWindow?.on('closed', () => {
      mainWindow = null;
    });

    if (!is.dev) {
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
        mainWindow = createWindow();
      }
    });
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}
