import type {BrowserWindow} from 'electron';
import {ipcMain, nativeTheme} from 'electron';

import type {Theme} from '../../../../../types/interfaces';

export function sendUpdateThemeEventTo(window: BrowserWindow) {
  nativeTheme.on('updated', () => {
    window.webContents.send('theme:update', nativeTheme.shouldUseDarkColors);
  });
}

export default () => {
  nativeTheme.themeSource = 'system';

  ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);

  ipcMain.handle('theme:toggle', (_e, theme: Theme) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });
};
