import { app, BrowserWindow, session } from 'electron';
import { join, resolve } from 'path';
import dotenv from 'dotenv';

import createMenu from './modules/menu';
import registerIpcListeners from './modules/ipcHandlers';

import createWindow from './windows/mainWindow';

dotenv.config({
  path: app.isPackaged ? join(process.resourcesPath, '.env') : resolve(process.cwd(), '.env'),
  override: true,
});

registerIpcListeners(app);

let mainWindow: BrowserWindow | null;

attachAppEvents();

function attachAppEvents() {
  app.on('ready', () => {
    createMenu();

    mainWindow = createWindow(app);

    /* main window events */
    mainWindow?.on('closed', () => {
      mainWindow = null;
    });

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
        createWindow(app);
      }
    });
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}
