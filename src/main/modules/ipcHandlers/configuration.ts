import { ipcMain } from 'electron';
import { Organization } from '../store';
import {
  clearStore,
  addOrganization,
  getMirrorNodeLinks,
  getOrganizations,
  removeOrganization,
  setMirrorNodeLinks,
} from '../../services/configuration';

const createChannelName = (...props) => ['configuration', ...props].join(':');

export default () => {
  /* Clear Config */
  ipcMain.handle(createChannelName('clear'), () => clearStore());

  /* Mirror Node Links */
  // Get
  ipcMain.handle(createChannelName('get', 'mirrorNodeLinks'), () => getMirrorNodeLinks());

  // Set
  const nodeTypes: ('mainnetLink' | 'testnetLink' | 'previewnetLink')[] = [
    'mainnetLink',
    'previewnetLink',
    'testnetLink',
  ];

  nodeTypes.forEach(nodeType => {
    ipcMain.handle(createChannelName('set', 'mirrorNodeLinks', nodeType), (e, link: string) => {
      return setMirrorNodeLinks(nodeType, link);
    });
  });

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
