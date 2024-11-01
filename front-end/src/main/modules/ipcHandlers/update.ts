import { app, ipcMain } from 'electron';

import { Updater } from '@main/services/update';

const createChannelName = (...props: string[]) => ['update', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('check-for-update'), (_e, location: string) =>
    Updater.checkForUpdate(location),
  );

  ipcMain.handle(createChannelName('get-version'), () => app.getVersion());
};
