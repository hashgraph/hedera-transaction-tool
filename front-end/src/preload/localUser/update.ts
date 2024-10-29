import { ipcRenderer } from 'electron';

export default {
  update: {
    onceCheckingForUpdateResult: (callback: (location: string | null) => void) => {
      ipcRenderer.once('update:check-for-update-result', (_e, location: string | null) =>
        callback(location),
      );
    },
    checkForUpdate: (location: string) => ipcRenderer.send('update:check-for-update', location),
  },
};
