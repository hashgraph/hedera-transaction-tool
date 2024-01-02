"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const electron_1 = require("electron");
const theme_1 = require("../modules/ipcHandlers/theme");
function createWindow(app) {
    const mainWindow = new electron_1.BrowserWindow({
        webPreferences: {
            preload: (0, path_1.join)(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false,
    });
    if (process.env.NODE_ENV === 'development') {
        const rendererPort = process.argv[2];
        mainWindow.loadURL(`http://localhost:${rendererPort}`);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile((0, path_1.join)(app.getAppPath(), 'renderer', 'index.html'));
    }
    /* main window web contents' events */
    mainWindow.webContents.on('did-finish-load', () => {
        if (mainWindow) {
            (0, theme_1.sendUpdateThemeEventTo)(mainWindow);
        }
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
        mainWindow.setFullScreen(true);
    });
    return mainWindow;
}
exports.default = createWindow;
