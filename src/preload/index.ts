import { contextBridge, ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

import { IOrganization, ITransaction } from '../main/shared/interfaces';

import { Theme } from '../main/modules/ipcHandlers/theme';
import { TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';
import { KeyPair, User } from '@prisma/client';

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
    getAll: (userId: string, organizationId?: string): Promise<KeyPair[]> =>
      ipcRenderer.invoke('keyPairs:getAll', userId, organizationId),
    getSecretHashes: (userId: string, organizationId?: string): Promise<string[]> =>
      ipcRenderer.invoke('keyPairs:getSecretHashes', userId, organizationId),
    store: (keyPair: KeyPair, password: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:store', keyPair, password),
    changeDecryptionPassword: (
      userId: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<KeyPair[]> =>
      ipcRenderer.invoke('keyPairs:changeDecryptionPassword', userId, oldPassword, newPassword),
    decryptPrivateKey: (userId: string, password: string, publicKey: string): Promise<string> =>
      ipcRenderer.invoke('keyPairs:decryptPrivateKey', userId, password, publicKey),
    deleteEncryptedPrivateKeys: (userId: string, organizationId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', userId, organizationId),
    clear: (userId: string, organizationId?: string): Promise<boolean> =>
      ipcRenderer.invoke('keyPairs:clear', userId, organizationId),
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
    login: (email: string, password: string, autoRegister?: boolean): Promise<User> =>
      ipcRenderer.invoke('localUser:login', email, password, autoRegister),
    register: (email: string, password: string): Promise<User> =>
      ipcRenderer.invoke('localUser:register', email, password),
    resetData: () => ipcRenderer.invoke('localUser:resetData'),
    usersCount: (): Promise<number> => ipcRenderer.invoke('localUser:usersCount'),
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
