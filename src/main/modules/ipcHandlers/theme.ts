import { BrowserWindow, ipcMain, nativeTheme } from 'electron';

export type Theme = 'system' | 'light' | 'dark';

export function sendUpdateThemeEventTo(window: BrowserWindow) {
  nativeTheme.on('updated', () => {
    window.webContents.send('theme:update', nativeTheme.shouldUseDarkColors);
  });
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
};
