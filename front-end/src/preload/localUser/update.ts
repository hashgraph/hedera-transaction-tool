import { ipcRenderer } from 'electron';

export default {
  update: {
    onceCheckingForUpdateResult: (callback: (file: string | null) => void) => {
      ipcRenderer.once('update:check-for-update-result', (_e, file: string | null) =>
        callback(file),
      );
    },
    checkForUpdate: (location: string) => ipcRenderer.send('update:check-for-update', location),
    getVerison: (): Promise<string> => ipcRenderer.invoke('update:get-version'),
  },
};
