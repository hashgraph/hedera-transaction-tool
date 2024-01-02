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
const updater_1 = __importDefault(require("./updater"));
function default_1() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac
            ? [
                {
                    //The first item in mac should match the application's name
                    label: 'hedera-transaction-tool',
                    submenu: [
                        { role: 'about' },
                        {
                            label: 'Check for updates',
                            click: () => {
                                (0, updater_1.default)();
                            },
                        },
                        { type: 'separator' },
                        { role: 'services' },
                        { type: 'separator' },
                        { type: 'separator' },
                        { role: 'quit' },
                    ],
                },
            ]
            : []),
        { role: 'editMenu' },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: () => __awaiter(this, void 0, void 0, function* () {
                        const { shell } = require('electron');
                        yield shell.openExternal('https://electronjs.org');
                    }),
                },
            ],
        },
    ];
    // @ts-ignore
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
exports.default = default_1;
