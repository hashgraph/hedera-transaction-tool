import { ipcMain } from 'electron';
import { Organization } from '../store';
import {
  clearStore,
  addOrganization,
  getOrganizations,
  removeOrganization,
} from '../../services/configuration';

const createChannelName = (...props) => ['configuration', ...props].join(':');

export default () => {
  /* Clear Config */
  ipcMain.handle(createChannelName('clear'), () => clearStore());

  /* Organizations */
  // Get
  ipcMain.handle(createChannelName('organizations', 'get'), () => getOrganizations());

  // Add
  ipcMain.handle(createChannelName('organizations', 'add'), (e, organization: Organization) => {
    addOrganization(organization);
  });

  // Remove
  ipcMain.handle(createChannelName('organizations', 'remove'), (e, serverUrl: string) => {
    removeOrganization(serverUrl);
  });
};
