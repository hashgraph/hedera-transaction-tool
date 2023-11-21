import { BrowserWindow, ipcMain, nativeTheme } from 'electron';

import { Theme } from '../shared/interfaces/theme';

export default () => {
  nativeTheme.themeSource = 'system';

  ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);

  ipcMain.handle('theme:toggle', (e, theme: Theme) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });

  function sendUpdateThemeEventTo(window: BrowserWindow) {
    nativeTheme.on('updated', () => {
      window.webContents.send('theme:update', nativeTheme.shouldUseDarkColors);
    });
  }

  return { sendUpdateThemeEventTo };
};
