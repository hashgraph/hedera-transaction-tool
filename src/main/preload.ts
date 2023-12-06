import { contextBridge, ipcRenderer } from 'electron';

import { Theme } from './modules/ipcHandlers/theme';
import { Organization, SchemaProperties } from './modules/store';
import { IKeyPair } from './shared/interfaces/IKeyPair';

export const electronAPI = {
  getNodeEnv: () => process.env.NODE_ENV,
  theme: {
    isDark: (): Promise<boolean> => ipcRenderer.invoke('theme:isDark'),
    toggle: (theme: Theme): Promise<boolean> => ipcRenderer.invoke('theme:toggle', theme),
    onThemeUpdate: (callback: (theme: boolean) => void) => {
      ipcRenderer.on('theme:update', (e, isDark: boolean) => callback(isDark));
    },
  },
  config: {
    clear: () => ipcRenderer.invoke('configuration:clear'),
    mirrorNodeLinks: {
      setLink: (key: keyof SchemaProperties['mirrorNodeLinks'], link: string): Promise<string> =>
        ipcRenderer.invoke(`configuration:set:mirrorNodeLinks:${key}`, link),
      getLinks: (): Promise<SchemaProperties['mirrorNodeLinks']> =>
        ipcRenderer.invoke('configuration:get:mirrorNodeLinks'),
    },
    organizations: {
      getAll: (): Promise<Organization[]> => ipcRenderer.invoke('configuration:organizations:get'),
      add: async (organization: Organization) => {
        ipcRenderer.invoke('configuration:organizations:add', organization);
      },
      removeByServerURL: async (serverUrl: string) => {
        ipcRenderer.invoke('configuration:organizations:remove', serverUrl);
      },
    },
  },
  recoveryPhrase: {
    downloadFileUnencrypted: (words: string[]): void => {
      ipcRenderer.invoke('recoveryPhrase:downloadFileUnencrypted', words);
    },
  },
  privateKey: {
    getStored: (userId: string): Promise<IKeyPair[]> =>
      ipcRenderer.invoke('privateKey:getStored', userId),
    store: (userId: string, password: string, keyPair: IKeyPair): Promise<void> =>
      ipcRenderer.invoke('privateKey:store', userId, password, keyPair),
    decryptPrivateKey: (userId: string, password: string, publicKey: string): Promise<string> =>
      ipcRenderer.invoke('privateKey:decryptPrivateKey', userId, password, publicKey),
    clear: (userId: string): Promise<boolean> => ipcRenderer.invoke('privateKey:clear', userId),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
