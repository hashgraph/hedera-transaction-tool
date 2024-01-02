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
exports.deleteSecretHashesFile = exports.deleteEncryptedPrivateKeys = exports.decryptPrivateKey = exports.changeDecryptionPassword = exports.storeKeyPair = exports.getStoredKeysSecretHashes = exports.getStoredKeyPairs = exports.getStoredSecretHashes = exports.getKeyPairsFilePath = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("../utils/crypto");
// Get key pairs Encrypted File Path
const getKeyPairsFilePath = (app, userId) => path_1.default.join(app.getPath('userData'), `${userId}.json`);
exports.getKeyPairsFilePath = getKeyPairsFilePath;
//Get all stored secret hash objects
const getStoredSecretHashes = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    let storedSecretHashes = [];
    if (fs_1.default.existsSync(filePath)) {
        const data = fs_1.default.readFileSync(filePath, 'utf8');
        storedSecretHashes = JSON.parse(data);
    }
    if (storedSecretHashes.length > 0 &&
        !Object.prototype.hasOwnProperty.call(storedSecretHashes[0], 'secretHash') &&
        !Object.prototype.hasOwnProperty.call(storedSecretHashes[0], 'keyPairs')) {
        yield (0, exports.deleteSecretHashesFile)(filePath);
        storedSecretHashes = [];
    }
    return storedSecretHashes;
});
exports.getStoredSecretHashes = getStoredSecretHashes;
//Get all stored key pairs
const getStoredKeyPairs = (filePath, secretHash, secretHashName) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const storedSecretHashes = yield (0, exports.getStoredSecretHashes)(filePath);
    if (secretHashName) {
        return ((_a = storedSecretHashes.find(sh => sh.name === secretHashName)) === null || _a === void 0 ? void 0 : _a.keyPairs) || [];
    }
    if (secretHash) {
        return ((_b = storedSecretHashes.find(sh => sh.secretHash === secretHash)) === null || _b === void 0 ? void 0 : _b.keyPairs) || [];
    }
    return storedSecretHashes.map(sh => sh.keyPairs).flat();
});
exports.getStoredKeyPairs = getStoredKeyPairs;
// Get secret hashes of currently saved keys
const getStoredKeysSecretHashes = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    const storedSecretHashes = yield (0, exports.getStoredSecretHashes)(filePath);
    return storedSecretHashes.map(sh => sh.secretHash);
});
exports.getStoredKeysSecretHashes = getStoredKeysSecretHashes;
// Store key pair
const storeKeyPair = (filePath, password, secretHash, keyPair) => __awaiter(void 0, void 0, void 0, function* () {
    keyPair.privateKey = yield (0, crypto_1.encrypt)(keyPair.privateKey, password);
    const storedSecretHashes = yield (0, exports.getStoredSecretHashes)(filePath);
    const storedSecretHash = storedSecretHashes.find(sh => sh.secretHash === secretHash);
    if (storedSecretHash) {
        const s_keyPair = storedSecretHash.keyPairs.find(kp => kp.publicKey === keyPair.publicKey);
        if (s_keyPair) {
            s_keyPair.privateKey = keyPair.privateKey;
        }
        else {
            storedSecretHash.keyPairs.push(keyPair);
        }
    }
    else {
        storedSecretHashes.push({ secretHash, keyPairs: [keyPair] });
    }
    fs_1.default.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');
});
exports.storeKeyPair = storeKeyPair;
// Change decryption password
const changeDecryptionPassword = (filePath, oldPassword, newPassword) => __awaiter(void 0, void 0, void 0, function* () {
    let storedSecretHashes = [];
    if (fs_1.default.existsSync(filePath)) {
        const data = fs_1.default.readFileSync(filePath, 'utf8');
        storedSecretHashes = JSON.parse(data);
    }
    storedSecretHashes.forEach(sh => {
        sh.keyPairs = sh.keyPairs.map(kp => {
            const decryptedPrivateKey = (0, crypto_1.decrypt)(kp.privateKey, oldPassword);
            const encryptedPrivateKey = (0, crypto_1.encrypt)(decryptedPrivateKey, newPassword);
            return Object.assign(Object.assign({}, kp), { privateKey: encryptedPrivateKey });
        });
    });
    fs_1.default.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');
    return storedSecretHashes;
});
exports.changeDecryptionPassword = changeDecryptionPassword;
// Decrypt user's private key
const decryptPrivateKey = (filePath, password, publicKey) => __awaiter(void 0, void 0, void 0, function* () {
    const userKeyPairs = yield (0, exports.getStoredKeyPairs)(filePath);
    const searchedKeyPair = userKeyPairs.find(kp => kp.publicKey === publicKey);
    const decryptedPrivateKey = (0, crypto_1.decrypt)(searchedKeyPair === null || searchedKeyPair === void 0 ? void 0 : searchedKeyPair.privateKey, password);
    return decryptedPrivateKey;
});
exports.decryptPrivateKey = decryptPrivateKey;
// Delete encrypted private keys
const deleteEncryptedPrivateKeys = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    const storedSecretHashes = yield (0, exports.getStoredSecretHashes)(filePath);
    storedSecretHashes.forEach(sh => {
        sh.keyPairs.forEach(kp => {
            kp.privateKey = '';
        });
    });
    fs_1.default.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');
});
exports.deleteEncryptedPrivateKeys = deleteEncryptedPrivateKeys;
// Clear user's keys
const deleteSecretHashesFile = (filePath) => promises_1.default.unlink(filePath);
exports.deleteSecretHashesFile = deleteSecretHashesFile;
