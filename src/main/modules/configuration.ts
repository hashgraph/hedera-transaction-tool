import { ipcMain } from 'electron';
import getStore, { SchemaProperties } from '../modules/store';

const store = getStore();

export const eventPrefix = 'configuration:';
export const createConfigurationChannelName = (...props) => `${eventPrefix}${props.join(':')}`;

export const setMirrorNodeSettings = (
  key: keyof SchemaProperties['mirrorNodeSettings'],
  link: string,
) => {
  store.set(`mirrorNodeSettings.${key}`, link);
};

export default () => {
  ipcMain.handle(
    createConfigurationChannelName('mirrorNodeSettings', 'mainnetLink'),
    (e, link: string) => {
      setMirrorNodeSettings('mainnetLink', link);
    },
  );

  ipcMain.handle(
    createConfigurationChannelName('mirrorNodeSettings', 'testnetLink'),
    (e, link: string) => {
      setMirrorNodeSettings('testnetLink', link);
    },
  );

  ipcMain.handle(
    createConfigurationChannelName('mirrorNodeSettings', 'previewnetLink'),
    (e, link: string) => {
      setMirrorNodeSettings('previewnetLink', link);
    },
  );

  return { setMirrorNodeSettings };
};
