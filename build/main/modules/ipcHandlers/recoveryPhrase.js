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
const promises_1 = __importDefault(require("fs/promises"));
const electron_1 = require("electron");
const createChannelName = (...props) => ['recoveryPhrase', ...props].join(':');
exports.default = () => {
    // Download recovery phrase object unencrypted
    electron_1.ipcMain.handle(createChannelName('downloadFileUnencrypted'), (e, words) => __awaiter(void 0, void 0, void 0, function* () {
        const file = yield electron_1.dialog.showSaveDialog({
            defaultPath: './recoveryPhrase.json',
            title: 'Save recovery phrase',
            message: 'Select where to save your recovery phrase as a JSON file',
        });
        if (!file.canceled) {
            promises_1.default.writeFile(file.filePath || '', JSON.stringify(words));
        }
    }));
};
