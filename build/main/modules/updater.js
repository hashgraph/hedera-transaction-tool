"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
/* Enable logging */
electron_updater_1.autoUpdater.logger = electron_log_1.default;
if (isMainLogger(electron_updater_1.autoUpdater.logger)) {
    electron_updater_1.autoUpdater.logger.transports.file.level = 'info';
}
electron_updater_1.autoUpdater.autoDownload = false;
function default_1() {
    electron_updater_1.autoUpdater.checkForUpdates();
    /* Ask for update */
    electron_updater_1.autoUpdater.on('update-available', () => __awaiter(this, void 0, void 0, function* () {
        const result = yield electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Update available',
            message: 'A new version is available',
            buttons: ['Update', 'No'],
        });
        if (result.response === 0) {
            electron_updater_1.autoUpdater.downloadUpdate();
        }
    }));
    /* Ask for install */
    electron_updater_1.autoUpdater.on('update-downloaded', () => __awaiter(this, void 0, void 0, function* () {
        const result = yield electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Update ready',
            message: 'Install and restart?',
            buttons: ['Yes', 'Later'],
        });
        if (result.response === 0) {
            electron_updater_1.autoUpdater.quitAndInstall(false, true);
        }
    }));
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Update not available',
            message: 'Application is up to date',
            buttons: ['Ok'],
        });
    });
}
exports.default = default_1;
function isMainLogger(logger) {
    return typeof logger.initialize === 'function';
}
