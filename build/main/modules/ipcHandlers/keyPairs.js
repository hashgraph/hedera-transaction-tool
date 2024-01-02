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
const electron_1 = require("electron");
const keyPairs_1 = require("../../services/keyPairs");
const createChannelName = (...props) => ['keyPairs', ...props].join(':');
exports.default = (app) => {
    // Generate key pair
    electron_1.ipcMain.handle(createChannelName('store'), (e, userId, password, secretHash, keyPair) => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, keyPairs_1.storeKeyPair)((0, keyPairs_1.getKeyPairsFilePath)(app, userId), password, secretHash, keyPair);
    }));
    // Change Decryption Password
    electron_1.ipcMain.handle(createChannelName('changeDecryptionPassword'), (e, userId, oldPassword, newPassword) => (0, keyPairs_1.changeDecryptionPassword)((0, keyPairs_1.getKeyPairsFilePath)(app, userId), oldPassword, newPassword));
    // Decrypted private key
    electron_1.ipcMain.handle(createChannelName('decryptPrivateKey'), (e, userId, password, publicKey) => __awaiter(void 0, void 0, void 0, function* () { return (0, keyPairs_1.decryptPrivateKey)((0, keyPairs_1.getKeyPairsFilePath)(app, userId), password, publicKey); }));
    // Decrypt stored key pairs
    electron_1.ipcMain.handle(createChannelName('getStored'), (e, userId, secretHash, secretHashName) => __awaiter(void 0, void 0, void 0, function* () { return (0, keyPairs_1.getStoredKeyPairs)((0, keyPairs_1.getKeyPairsFilePath)(app, userId), secretHash, secretHashName); }));
    // Decrypt stored key pairs
    electron_1.ipcMain.handle(createChannelName('getStoredKeysSecretHashes'), (e, userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, keyPairs_1.getStoredKeysSecretHashes)((0, keyPairs_1.getKeyPairsFilePath)(app, userId)); }));
    // Delete encrypted private keys
    electron_1.ipcMain.handle(createChannelName('deleteEncryptedPrivateKeys'), (e, userId) => __awaiter(void 0, void 0, void 0, function* () { return (0, keyPairs_1.deleteEncryptedPrivateKeys)((0, keyPairs_1.getKeyPairsFilePath)(app, userId)); }));
    // Clear keys file
    electron_1.ipcMain.handle(createChannelName('clear'), (e, userId) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, keyPairs_1.deleteSecretHashesFile)((0, keyPairs_1.getKeyPairsFilePath)(app, userId));
            return true;
        }
        catch (_a) {
            console.log('no such folder');
        }
    }));
};
