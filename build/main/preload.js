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
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronAPI = void 0;
const electron_1 = require("electron");
exports.electronAPI = {
    getNodeEnv: () => process.env.NODE_ENV,
    theme: {
        isDark: () => electron_1.ipcRenderer.invoke('theme:isDark'),
        toggle: (theme) => electron_1.ipcRenderer.invoke('theme:toggle', theme),
        onThemeUpdate: (callback) => {
            electron_1.ipcRenderer.on('theme:update', (e, isDark) => callback(isDark));
        },
    },
    config: {
        clear: () => electron_1.ipcRenderer.invoke('configuration:clear'),
        organizations: {
            getAll: () => electron_1.ipcRenderer.invoke('configuration:organizations:get'),
            add: (organization) => __awaiter(void 0, void 0, void 0, function* () {
                electron_1.ipcRenderer.invoke('configuration:organizations:add', organization);
            }),
            removeByServerURL: (serverUrl) => __awaiter(void 0, void 0, void 0, function* () {
                electron_1.ipcRenderer.invoke('configuration:organizations:remove', serverUrl);
            }),
        },
    },
    keyPairs: {
        getStored: (userId, secretHash, secretHashName) => electron_1.ipcRenderer.invoke('keyPairs:getStored', userId, secretHash, secretHashName),
        getStoredKeysSecretHashes: (userId) => electron_1.ipcRenderer.invoke('keyPairs:getStoredKeysSecretHashes', userId),
        store: (userId, password, secretHash, keyPair) => electron_1.ipcRenderer.invoke('keyPairs:store', userId, password, secretHash, keyPair),
        changeDecryptionPassword: (userId, oldPassword, newPassword) => electron_1.ipcRenderer.invoke('keyPairs:changeDecryptionPassword', userId, oldPassword, newPassword),
        decryptPrivateKey: (userId, password, publicKey) => electron_1.ipcRenderer.invoke('keyPairs:decryptPrivateKey', userId, password, publicKey),
        deleteEncryptedPrivateKeys: (userId) => electron_1.ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', userId),
        clear: (userId) => electron_1.ipcRenderer.invoke('keyPairs:clear', userId),
    },
    utils: {
        openExternal: (url) => electron_1.ipcRenderer.send('utils:openExternal', url),
        decodeProtobuffKey: (protobuffEncodedKey) => electron_1.ipcRenderer.invoke('utils:decodeProtobuffKey', protobuffEncodedKey),
        hash: (data) => electron_1.ipcRenderer.invoke('utils:hash', data),
    },
};
typeof exports.electronAPI;
electron_1.contextBridge.exposeInMainWorld('electronAPI', exports.electronAPI);
