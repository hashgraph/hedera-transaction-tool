import { contextBridge, ipcRenderer } from 'electron';

import { Theme } from './shared/interfaces/theme';

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) => ipcRenderer.send('message', message),
  getNodeEnv: () => process.env.NODE_ENV,
  theme: {
    isDark: (): Promise<boolean> => ipcRenderer.invoke('theme:isDark'),
    toggle: (theme: Theme): Promise<boolean> => ipcRenderer.invoke('theme:toggle', theme),
    onThemeUpdate: (callback: (theme: boolean) => void) => {
      ipcRenderer.on('theme:update', (e, isDark: boolean) => callback(isDark));
    },
  },
});
