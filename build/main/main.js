"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const dotenv_1 = __importDefault(require("dotenv"));
const menu_1 = __importDefault(require("./modules/menu"));
const ipcHandlers_1 = __importDefault(require("./modules/ipcHandlers"));
const mainWindow_1 = __importDefault(require("./windows/mainWindow"));
dotenv_1.default.config({
    path: electron_1.app.isPackaged ? (0, path_1.join)(process.resourcesPath, '.env') : (0, path_1.resolve)(process.cwd(), '.env'),
    override: true,
});
(0, ipcHandlers_1.default)(electron_1.app);
let mainWindow;
attachAppEvents();
function attachAppEvents() {
    electron_1.app.on('ready', () => {
        (0, menu_1.default)();
        mainWindow = (0, mainWindow_1.default)(electron_1.app);
        /* main window events */
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.on('closed', () => {
            mainWindow = null;
        });
        if (process.env.NODE_ENV === 'production') {
            electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: Object.assign(Object.assign({}, details.responseHeaders), { 'Content-Security-Policy': ["script-src 'self'"] }),
                });
            });
        }
        electron_1.app.on('activate', function () {
            if (mainWindow === null) {
                (0, mainWindow_1.default)(electron_1.app);
            }
        });
    });
    electron_1.app.on('window-all-closed', function () {
        if (process.platform !== 'darwin')
            electron_1.app.quit();
    });
}
