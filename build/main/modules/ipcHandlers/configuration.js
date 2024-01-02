"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const configuration_1 = require("../../services/configuration");
const createChannelName = (...props) => ['configuration', ...props].join(':');
exports.default = () => {
    /* Clear Config */
    electron_1.ipcMain.handle(createChannelName('clear'), () => (0, configuration_1.clearStore)());
    /* Organizations */
    // Get
    electron_1.ipcMain.handle(createChannelName('organizations', 'get'), () => (0, configuration_1.getOrganizations)());
    // Add
    electron_1.ipcMain.handle(createChannelName('organizations', 'add'), (e, organization) => {
        (0, configuration_1.addOrganization)(organization);
    });
    // Remove
    electron_1.ipcMain.handle(createChannelName('organizations', 'remove'), (e, serverUrl) => {
        (0, configuration_1.removeOrganization)(serverUrl);
    });
};
