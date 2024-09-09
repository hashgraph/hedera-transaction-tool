import * as path from 'path';
import { app, BrowserWindow, session } from 'electron';
import { optimizer, is } from '@electron-toolkit/utils';

import initDatabase from '@main/db/init';

import initLogger from '@main/modules/logger';
import createMenu from '@main/modules/menu';
import handleDeepLink, { PROTOCOL_NAME } from '@main/modules/deepLink';
import registerIpcListeners from '@main/modules/ipcHandlers';

import { restoreOrCreateWindow } from '@main/windows/mainWindow';

import { deleteAllTempFolders } from './services/localUser';

let mainWindow: BrowserWindow | null;

initLogger();

run();

async function run() {
  await initDatabase();

  registerIpcListeners();
}

attachAppEvents();
setupDeepLink();

function attachAppEvents() {
  app.on('ready', async () => {
    await initMainWindow();

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
        await initMainWindow();
      }
    });
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });

  let deleteRetires = 0;
  app.on('before-quit', async function (e) {
    mainWindow?.close();

    if (deleteRetires === 0) {
      e.preventDefault();

      deleteRetires++;
      try {
        await deleteAllTempFolders();
      } catch {
        /* Empty */
      }

      app.quit();
    }
  });

  app.on('open-url', (event, url) => {
    if (mainWindow === null) return;
    handleDeepLink(mainWindow, event, url);
  });
}

async function initMainWindow() {
  mainWindow = await restoreOrCreateWindow();

  createMenu(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupDeepLink() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME);
  }
}
