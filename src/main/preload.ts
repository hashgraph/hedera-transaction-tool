import { contextBridge, ipcRenderer } from 'electron';

import { Theme } from './modules/theme';
import { SchemaProperties } from './modules/store';

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
  config: {
    mirrorNodeLinks: {
      setLink: (key: keyof SchemaProperties['mirrorNodeLinks'], link: string): Promise<string> =>
        ipcRenderer.invoke(`configuration:set:mirrorNodeLinks:${key}`, link),
      getLinks: (): Promise<SchemaProperties['mirrorNodeLinks']> =>
        ipcRenderer.invoke('configuration:get:mirrorNodeLinks'),
    },
  },
});
