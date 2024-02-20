import type {BrowserWindow} from 'electron';
import {app, session} from 'electron';
import {optimizer, is} from '@electron-toolkit/utils';

import initDatabase from '@main/db';

import initLogger from '@main/modules/logger';
import createMenu from '@main/modules/menu';
import registerIpcListeners from '@main/modules/ipcHandlers';

import createWindow from '@main/windows/mainWindow';

let mainWindow: BrowserWindow | null;

initLogger();

run();

async function run() {
  await initDatabase();

  registerIpcListeners();
}

attachAppEvents();

function attachAppEvents() {
  app.on('ready', async () => {
    mainWindow = await createWindow();

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

    app.on('activate', async function () {
      if (mainWindow === null) {
        mainWindow = await createWindow();
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
