"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_store_1 = __importDefault(require("electron-store"));
/* Module for persisting data in a JSON file */
function getStore() {
    /* See more about JSON Schema here: https://json-schema.org/learn/getting-started-step-by-step */
    const schema = {
        organizations: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                    },
                    serverUrl: {
                        type: 'string',
                    },
                    serverPublicKey: {
                        type: 'string',
                    },
                },
            },
            default: [],
            uniqueItems: true,
        },
    };
    const store = new electron_store_1.default({ schema, clearInvalidConfig: true });
    return store;
}
exports.default = getStore;
