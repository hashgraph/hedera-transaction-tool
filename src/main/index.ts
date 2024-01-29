import { app, BrowserWindow, session } from 'electron';
import { optimizer, is } from '@electron-toolkit/utils';

import initDatabase from './db';

import createMenu from './modules/menu';
import registerIpcListeners from './modules/ipcHandlers';

import createWindow from './windows/mainWindow';

initDatabase();
registerIpcListeners();

let mainWindow: BrowserWindow | null;

attachAppEvents();

function attachAppEvents() {
  app.on('ready', () => {
    createMenu();

    mainWindow = createWindow();

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
        createWindow();
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
