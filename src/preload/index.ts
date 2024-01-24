import { contextBridge, ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

import { IKeyPair, IOrganization, ITransaction } from '../main/shared/interfaces';

import { Theme } from '../main/modules/ipcHandlers/theme';
import { TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

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
      keyPair: IKeyPair,
      secretHash?: string,
      serverUrl?: string,
      userId?: string,
    ): Promise<void> =>
      ipcRenderer.invoke('keyPairs:store', email, password, keyPair, secretHash, serverUrl, userId),
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
  },
  accounts: {
    getAll: (email: string): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:getAll', email),
    add: (
      email: string,
      accountId: string,
      nickname: string,
    ): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:add', email, accountId, nickname),
    remove: (
      email: string,
      accountId: string,
      nickname: string,
    ): Promise<{ accountId: string; nickname: string }[]> =>
      ipcRenderer.invoke('accounts:remove', email, accountId, nickname),
  },
  localUser: {
    login: (email: string, password: string, autoRegister?: boolean): Promise<boolean> =>
      ipcRenderer.invoke('localUser:login', email, password, autoRegister),
    register: (email: string, password: string) =>
      ipcRenderer.invoke('localUser:register', email, password),
    resetData: (options?: {
      email: string;
      authData?: boolean;
      keys?: boolean;
      transactions?: boolean;
      organizations?: boolean;
    }) => ipcRenderer.invoke('localUser:resetData', options),
    hasRegisteredUsers: () => ipcRenderer.invoke('localUser:hasRegisteredUsers'),
  },
  transactions: {
    executeTransaction: (
      transactionData: string,
    ): Promise<{
      response: TransactionResponse;
      receipt: TransactionReceipt;
      transactionId: string;
    }> => ipcRenderer.invoke('transactions:executeTransaction', transactionData),
    executeQuery: (queryData: string) => ipcRenderer.invoke('transactions:executeQuery', queryData),
    saveTransaction: (email: string, transaction: ITransaction) =>
      ipcRenderer.invoke('transactions:saveTransaction', email, transaction),
    getTransactions: (email: string, serverUrl?: string): Promise<ITransaction[]> =>
      ipcRenderer.invoke('transactions:getTransactions', email, serverUrl),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
