import { ipcMain, shell } from 'electron';

const createChannelName = (...props) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (e, url: string) => shell.openExternal(url));
};
