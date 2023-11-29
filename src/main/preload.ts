import { contextBridge, ipcRenderer } from 'electron';

import { Theme } from './modules/ipcHandlers/theme';
import { Organization, SchemaProperties } from './modules/store';
import { Mnemonic } from '@hashgraph/sdk';

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
    generate: (): Promise<Mnemonic> => ipcRenderer.invoke('recoveryPhrase:generate'),
    downloadFileUnencrypted: (words: string[]): void => {
      ipcRenderer.invoke('recoveryPhrase:downloadFileUnencrypted', words);
    },
    encryptRecoveryPhrase: (recoveryPhrase: string[]): Promise<boolean> =>
      ipcRenderer.invoke('recoveryPhrase:encryptRecoveryPhrase', recoveryPhrase),
    decryptRecoveryPhrase: (): Promise<string[]> =>
      ipcRenderer.invoke('recoveryPhrase:decryptRecoveryPhrase'),
  },
  privateKey: {
    generate: (passphrase: string, index: number): Promise<string> =>
      ipcRenderer.invoke('privateKey:generate', passphrase, index),
    getStored: (): Promise<string[]> => ipcRenderer.invoke('privateKey:getStored'),
  },
});
