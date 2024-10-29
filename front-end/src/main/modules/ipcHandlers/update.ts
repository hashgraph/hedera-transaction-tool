import { ipcMain } from 'electron';

import { checkForUpdate } from '@main/services/update';

const createChannelName = (...props: string[]) => ['update', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('check-for-update'), () => checkForUpdate());
};
