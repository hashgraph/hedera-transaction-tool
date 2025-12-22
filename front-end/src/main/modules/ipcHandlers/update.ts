import { app, ipcMain } from 'electron';

import { Updater } from '@main/services/update';
import { getUpdaterService } from '@main/services/electronUpdater';

const createChannelName = (...props: string[]) => ['update', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('check-for-update'), (_e, location: string) =>
    Updater.checkForUpdate(location),
  );

  ipcMain.handle(createChannelName('get-version'), () => app.getVersion());

  ipcMain.on(createChannelName('start-download'), (_e, updateUrl: string) => {
    const updaterService = getUpdaterService();
    if (updaterService) {
      updaterService.checkForUpdatesAndDownload(updateUrl);
    }
  });

  ipcMain.on(createChannelName('install'), () => {
    const updaterService = getUpdaterService();
    if (updaterService) {
      updaterService.quitAndInstall();
    }
  });

  ipcMain.on(createChannelName('cancel'), () => {
    const updaterService = getUpdaterService();
    if (updaterService) {
      updaterService.cancelUpdate();
    }
  });
};
