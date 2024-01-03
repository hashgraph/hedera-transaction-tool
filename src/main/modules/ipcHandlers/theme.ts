import { BrowserWindow, ipcMain, nativeTheme } from 'electron';

export type Theme = 'system' | 'light' | 'dark';

export function sendUpdateThemeEventTo(window: BrowserWindow) {
  nativeTheme.on('updated', () => {
    window.webContents.send('theme:update', nativeTheme.shouldUseDarkColors);
  });
}

export default () => {
  nativeTheme.themeSource = 'system';

  ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);

  ipcMain.handle('theme:toggle', (e, theme: Theme) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });
};
