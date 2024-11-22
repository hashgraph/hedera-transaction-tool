import { BrowserWindow, ipcMain, nativeTheme } from 'electron';

import { Theme } from '@main/shared/interfaces';

export function sendUpdateThemeEventTo(window: BrowserWindow) {
  if (nativeTheme.listenerCount('updated') === 0) {
    nativeTheme.on('updated', () => {
      window.webContents.send('theme:update', {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        themeSource: nativeTheme.themeSource,
      });
    });
  }
}

export function removeListeners() {
  nativeTheme.removeAllListeners('updated');
}

export default () => {
  nativeTheme.themeSource = 'system';

  ipcMain.handle('theme:isDark', () => {
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('theme:toggle', (_e, theme: Theme) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('theme:mode', () => {
    return nativeTheme.themeSource;
  });
};
