import { contextBridge, ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

import { IKeyPair, IOrganization } from '../main/shared/interfaces';

import { Theme } from '../main/modules/ipcHandlers/theme';

export const electronAPI = {
  theme: {
    isDark: (): Promise<boolean> => ipcRenderer.invoke('theme:isDark'),
    toggle: (theme: Theme): Promise<boolean> => ipcRenderer.invoke('theme:toggle', theme),
    onThemeUpdate: async (callback: (theme: boolean) => void) => {
      await ipcRenderer.on('theme:update', (_e, isDark: boolean) => callback(isDark));
    },
  },
  config: {
    clear: () => ipcRenderer.invoke('configuration:clear'),
    organizations: {
      getAll: (): Promise<IOrganization[]> => ipcRenderer.invoke('configuration:organizations:get'),
      add: async (organization: IOrganization) => {
        await ipcRenderer.invoke('configuration:organizations:add', organization);
      },
      removeByServerURL: async (serverUrl: string) => {
        await ipcRenderer.invoke('configuration:organizations:remove', serverUrl);
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
    executeTransaction: (transactionData: string) =>
      ipcRenderer.invoke('utils:executeTransaction', transactionData),
    executeQuery: (queryData: string) => ipcRenderer.invoke('utils:executeQuery', queryData),
  },
  accounts: {
    getAll: (userId: string): Promise<string[]> => ipcRenderer.invoke('accounts:getAll', userId),
    add: (userId: string, accountId: string, nickname: string): Promise<string[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, nickname),
    remove: (userId: string, accountId: string, nickname: string): Promise<string[]> =>
      ipcRenderer.invoke('accounts:remove', userId, accountId, nickname),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
