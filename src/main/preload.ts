import { contextBridge, ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

import { IKeyPair } from './shared/interfaces';

import { Theme } from './modules/ipcHandlers/theme';
import { Organization } from './modules/store';

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
  keyPairs: {
    getStored: (
      userId: string,
      secretHash?: string,
      secretHashName?: string,
    ): Promise<IKeyPair[]> =>
      ipcRenderer.invoke('keyPairs:getStored', userId, secretHash, secretHashName),
    getStoredKeysSecretHashes: (userId: string): Promise<string[]> =>
      ipcRenderer.invoke('keyPairs:getStoredKeysSecretHashes', userId),
    store: (
      userId: string,
      password: string,
      secretHash: string,
      keyPair: IKeyPair,
    ): Promise<void> => ipcRenderer.invoke('keyPairs:store', userId, password, secretHash, keyPair),
    changeDecryptionPassword: (
      userId: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<IKeyPair[]> =>
      ipcRenderer.invoke('keyPairs:changeDecryptionPassword', userId, oldPassword, newPassword),
    decryptPrivateKey: (userId: string, password: string, publicKey: string): Promise<string> =>
      ipcRenderer.invoke('keyPairs:decryptPrivateKey', userId, password, publicKey),
    deleteEncryptedPrivateKeys: (userId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', userId),
    clear: (userId: string): Promise<boolean> => ipcRenderer.invoke('keyPairs:clear', userId),
  },
  utils: {
    openExternal: (url: string) => ipcRenderer.send('utils:openExternal', url),
    decodeProtobuffKey: (protobuffEncodedKey: string): Promise<proto.Key> =>
      ipcRenderer.invoke('utils:decodeProtobuffKey', protobuffEncodedKey),
    hash: (data: any): Promise<string> => ipcRenderer.invoke('utils:hash', data),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
