import { ipcRenderer } from 'electron';

import { Theme } from '@main/shared/interfaces';

export default {
  theme: {
    isDark: (): Promise<boolean> => ipcRenderer.invoke('theme:isDark'),
    mode: (): Promise<Theme> => ipcRenderer.invoke('theme:mode'),
    toggle: (theme: Theme): Promise<boolean> => ipcRenderer.invoke('theme:toggle', theme),
    onThemeUpdate: (
      callback: (theme: { themeSource: Theme; shouldUseDarkColors: boolean }) => void,
    ) => {
      const subscription = (_e, theme: { themeSource: Theme; shouldUseDarkColors: boolean }) =>
        callback(theme);
      ipcRenderer.on('theme:update', subscription);
      return () => {
        ipcRenderer.removeListener('theme:update', subscription);
      };
    },
  },
};
