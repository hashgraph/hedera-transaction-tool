import { ipcRenderer } from 'electron';

export default {
  settings: {
    onSettings: (callback: () => void) => ipcRenderer.on('settings', _event => callback()),
  },
};
