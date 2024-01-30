import { contextBridge, ipcRenderer } from 'electron';
import { HederaAccount, KeyPair, Transaction, User } from '@prisma/client';

import { proto } from '@hashgraph/proto';

import { IOrganization } from '../main/shared/interfaces';

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
    getAll: (email: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:getAll', email),
    add: (email: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:add', email, accountId, nickname),
    remove: (email: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:remove', email, accountId, nickname),
  },
  localUser: {
    login: (email: string, password: string, autoRegister?: boolean): Promise<User> =>
      ipcRenderer.invoke('localUser:login', email, password, autoRegister),
    register: (email: string, password: string): Promise<User> =>
      ipcRenderer.invoke('localUser:register', email, password),
    resetData: () => ipcRenderer.invoke('localUser:resetData'),
    usersCount: (): Promise<number> => ipcRenderer.invoke('localUser:usersCount'),
    comparePasswords: (userId: string, password: string): Promise<boolean> =>
      ipcRenderer.invoke('localUser:comparePasswords', userId, password),
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
    storeTransaction: (transaction: Transaction): Promise<Transaction[]> =>
      ipcRenderer.invoke('transactions:storeTransaction', transaction),
    getTransactions: (user_id: string): Promise<Transaction[]> =>
      ipcRenderer.invoke('transactions:getTransactions', user_id),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
