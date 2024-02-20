import {ipcMain} from 'electron';

import type {IOrganization} from '../../../../../types/interfaces';

import {
  clearStore,
  addOrganization,
  getOrganizations,
  removeOrganization,
} from '@main/services/configuration';

const createChannelName = (...props: string[]) => ['configuration', ...props].join(':');

export default () => {
  /* Clear Config */
  ipcMain.handle(createChannelName('clear'), () => clearStore());

  /* Organizations */
  // Get
  ipcMain.handle(createChannelName('organizations', 'get'), () => getOrganizations());

  // Add
  ipcMain.handle(createChannelName('organizations', 'add'), (_e, organization: IOrganization) => {
    addOrganization(organization);
  });

  // Remove
  ipcMain.handle(createChannelName('organizations', 'remove'), (_e, serverUrl: string) => {
    removeOrganization(serverUrl);
  });
};
