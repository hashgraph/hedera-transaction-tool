import { ipcMain } from 'electron';
import getStore, { SchemaProperties } from '../modules/store';

const store = getStore();

export const eventPrefix = 'configuration:';
export const createConfigurationChannelName = (...props) => `${eventPrefix}${props.join(':')}`;

export const setMirrorNodeLinks = (
  key: keyof SchemaProperties['mirrorNodeLinks'],
  link: string,
) => {
  store.set(`mirrorNodeLinks.${key}`, link);
  return store.get(`mirrorNodeLinks.${key}`);
};

export const getMirrorNodeLinks = () => store.get('mirrorNodeLinks');

export default () => {
  ipcMain.handle(
    createConfigurationChannelName('set', 'mirrorNodeLinks', 'mainnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('mainnetLink', link);
    },
  );

  ipcMain.handle(
    createConfigurationChannelName('set', 'mirrorNodeLinks', 'testnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('testnetLink', link);
    },
  );

  ipcMain.handle(
    createConfigurationChannelName('set', 'mirrorNodeLinks', 'previewnetLink'),
    (e, link: string) => {
      return setMirrorNodeLinks('previewnetLink', link);
    },
  );

  ipcMain.handle(createConfigurationChannelName('get', 'mirrorNodeLinks'), () =>
    getMirrorNodeLinks(),
  );

  return { setMirrorNodeLinks };
};
