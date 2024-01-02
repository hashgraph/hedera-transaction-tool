"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const proto_1 = require("@hashgraph/proto");
const crypto_1 = require("../../utils/crypto");
const createChannelName = (...props) => ['utils', ...props].join(':');
exports.default = () => {
    electron_1.ipcMain.on(createChannelName('openExternal'), (e, url) => electron_1.shell.openExternal(url));
    electron_1.ipcMain.handle(createChannelName('decodeProtobuffKey'), (e, protobuffEncodedKey) => {
        const buffer = Buffer.from(protobuffEncodedKey, 'hex');
        const key = proto_1.proto.Key.decode(buffer);
        return key;
    });
    electron_1.ipcMain.handle(createChannelName('hash'), (e, data) => {
        const hashBuffer = (0, crypto_1.hash)(Buffer.from(data));
        const str = hashBuffer.toString('hex');
        return str;
    });
};
