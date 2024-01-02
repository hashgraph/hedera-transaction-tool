"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUpdateThemeEventTo = void 0;
const electron_1 = require("electron");
function sendUpdateThemeEventTo(window) {
    electron_1.nativeTheme.on('updated', () => {
        window.webContents.send('theme:update', electron_1.nativeTheme.shouldUseDarkColors);
    });
}
exports.sendUpdateThemeEventTo = sendUpdateThemeEventTo;
exports.default = () => {
    electron_1.nativeTheme.themeSource = 'system';
    electron_1.ipcMain.handle('theme:isDark', () => electron_1.nativeTheme.shouldUseDarkColors);
    electron_1.ipcMain.handle('theme:toggle', (e, theme) => {
        electron_1.nativeTheme.themeSource = theme;
        return electron_1.nativeTheme.shouldUseDarkColors;
    });
};
