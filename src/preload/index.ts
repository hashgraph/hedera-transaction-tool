import { contextBridge, ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

import { IKeyPair, IOrganization } from '../main/shared/interfaces';

import { Theme } from '../main/modules/ipcHandlers/theme';
import { ILocalUserData } from '../main/shared/interfaces/ILocalUserData';

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
      email: string,
      serverUrl?: string,
      userId?: string,
      secretHash?: string,
      secretHashName?: string,
    ): Promise<IKeyPair[]> =>
      ipcRenderer.invoke(
        'keyPairs:getStored',
        email,
        serverUrl,
        userId,
        secretHash,
        secretHashName,
      ),
    getStoredKeysSecretHashes: (
      email: string,
      serverUrl?: string,
      userId?: string,
    ): Promise<string[]> =>
      ipcRenderer.invoke('keyPairs:getStoredKeysSecretHashes', email, serverUrl, userId),
    store: (
      email: string,
      password: string,
      secretHash: string,
      keyPair: IKeyPair,
      serverUrl?: string,
      userId?: string,
    ): Promise<void> =>
      ipcRenderer.invoke('keyPairs:store', email, password, secretHash, keyPair, serverUrl, userId),
    changeDecryptionPassword: (
      email: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<IKeyPair[]> =>
      ipcRenderer.invoke('keyPairs:changeDecryptionPassword', email, oldPassword, newPassword),
    decryptPrivateKey: (email: string, password: string, publicKey: string): Promise<string> =>
      ipcRenderer.invoke('keyPairs:decryptPrivateKey', email, password, publicKey),
    deleteEncryptedPrivateKeys: (email: string, serverUrl: string, userId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', email, serverUrl, userId),
    clear: (email: string, serverUrl?: string, userId?: string): Promise<boolean> =>
      ipcRenderer.invoke('keyPairs:clear', email, serverUrl, userId),
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
    getAll: (userId: string): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:getAll', userId),
    add: (
      userId: string,
      accountId: string,
      nickname: string,
    ): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, nickname),
    remove: (
      userId: string,
      accountId: string,
      nickname: string,
    ): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:remove', userId, accountId, nickname),
  },
  localUser: {
    login: (email: string, password: string, autoRegister?: boolean): Promise<ILocalUserData> =>
      ipcRenderer.invoke('localUser:login', email, password, autoRegister),
    register: (email: string, password: string) =>
      ipcRenderer.invoke('localUser:register', email, password),
    resetData: (
      email: string,
      options: {
        authData?: boolean;
        keys?: boolean;
        transactions?: boolean;
        organizations?: boolean;
      },
    ) => ipcRenderer.invoke('localUser:resetData', email, options),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
