"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = exports.createCredentials = exports.hash = void 0;
const crypto_1 = __importDefault(require("crypto"));
function hash(data) {
    return crypto_1.default.createHash('sha256').update(data).digest();
}
exports.hash = hash;
function createCredentials(password) {
    let temp = hash(password);
    const iv = temp.slice(0, 16);
    temp = hash(temp);
    const key = temp.slice(8);
    return [key, iv];
}
exports.createCredentials = createCredentials;
function encrypt(data, password) {
    data = Buffer.from(data, 'utf-8').toString('hex');
    const [key, iv] = createCredentials(password);
    const cipher = crypto_1.default.createCipheriv('aes-192-cbc', key, iv);
    const encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}
exports.encrypt = encrypt;
function decrypt(data, password) {
    const [key, iv] = createCredentials(password);
    const decipher = crypto_1.default.createDecipheriv('aes-192-cbc', key, iv);
    const hex = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
    return Buffer.from(hex, 'hex').toString('utf-8');
}
exports.decrypt = decrypt;
