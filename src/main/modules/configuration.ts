import { ipcMain } from 'electron';
import getStore, { Organization, SchemaProperties } from '../modules/store';

const store = getStore();

export const createChannelName = (...props) => props.join(':');

/* Mirror Node Links */
export const getMirrorNodeLinks = () => store.get('mirrorNodeLinks');
export const setMirrorNodeLinks = (
  key: keyof SchemaProperties['mirrorNodeLinks'],
  link: string,
) => {
  store.set(`mirrorNodeLinks.${key}`, link);
  return store.get(`mirrorNodeLinks.${key}`);
};

/* Organizations */
export const getOrganizations = () => store.get('organizations');
export const addOrganization = (organization: Organization) =>
  store.set('organizations', [organization, ...store.store.organizations]);
export const removeOrganization = (serverUrl: string) =>
  store.set(
    'organizations',
    store.store.organizations.filter(o => o.serverUrl !== serverUrl),
  );

export default () => {
  /* Clear Config */
  ipcMain.handle(createChannelName('configuration', 'clear'), () => store.clear());

  /* Mirror Node Links */

  // Get
  ipcMain.handle(createChannelName('configuration', 'get', 'mirrorNodeLinks'), () =>
    getMirrorNodeLinks(),
  );

  // Set
  ipcMain.handle(
    createChannelName('configuration', 'set', 'mirrorNodeLinks', 'mainnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('mainnetLink', link);
    },
  );

  ipcMain.handle(
    createChannelName('configuration', 'set', 'mirrorNodeLinks', 'testnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('testnetLink', link);
    },
  );

  ipcMain.handle(
    createChannelName('configuration', 'set', 'mirrorNodeLinks', 'previewnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('previewnetLink', link);
    },
  );

  /* Organizations */

  // Get
  ipcMain.handle(createChannelName('configuration', 'organizations', 'get'), () =>
    getOrganizations(),
  );

  // Add
  ipcMain.handle(
    createChannelName('configuration', 'organizations', 'add'),
    (e, organization: Organization) => {
      if (
        store.store.organizations.some(
          org => org.name === organization.name || org.serverUrl === organization.serverUrl,
        )
      ) {
        throw new Error('Organization with that name or serverUrl exists!');
      }
      addOrganization(organization);
    },
  );

  // Remove
  ipcMain.handle(
    createChannelName('configuration', 'organizations', 'remove'),
    (e, serverUrl: string) => {
      removeOrganization(serverUrl);
    },
  );

  return {
    getMirrorNodeLinks,
    setMirrorNodeLinks,
    getOrganizations,
    addOrganization,
    removeOrganization,
  };
};
