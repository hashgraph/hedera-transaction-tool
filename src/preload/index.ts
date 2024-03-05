import { contextBridge, ipcRenderer } from 'electron';
import { ProgressInfo, UpdateInfo } from 'electron-updater';

import { proto } from '@hashgraph/proto';

import {
  HederaAccount,
  HederaFile,
  KeyPair,
  Prisma,
  Transaction,
  TransactionDraft,
  User,
} from '@prisma/client';

import { IOrganization } from '@main/shared/interfaces';

import { Theme } from '@main/modules/ipcHandlers/theme';

export const electronAPI = {
  update: {
    onCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('update:checking-for-update', () => callback());
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('update:error', (_e, error: string) => callback(error));
    },
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:update-available', (_e, info: UpdateInfo) => callback(info));
    },
    onUpdateNotAvailable: (callback: () => void) => {
      ipcRenderer.on('update:update-not-available', () => callback());
    },
    downloadUpdate: () => ipcRenderer.send('update:download-update'),
    onDownloadProgess: (callback: (info: ProgressInfo) => void) => {
      ipcRenderer.on('update:download-progress', (_e, info: ProgressInfo) => callback(info));
    },
    onUpdateDownloaded: (callback: () => void) => {
      ipcRenderer.on('update:update-downloaded', () => callback());
    },
    quitAndInstall: () => ipcRenderer.send('update:quit-install'),
  },
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
    store: (keyPair: Prisma.KeyPairUncheckedCreateInput, password: string): Promise<void> =>
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
    deleteKeyPair: (keyPairId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteKeyPair', keyPairId),
  },
  utils: {
    openExternal: (url: string) => ipcRenderer.send('utils:openExternal', url),
    decodeProtobuffKey: (protobuffEncodedKey: string): Promise<proto.Key> =>
      ipcRenderer.invoke('utils:decodeProtobuffKey', protobuffEncodedKey),
    hash: (data: any): Promise<string> => ipcRenderer.invoke('utils:hash', data),
    uint8ArrayToHex: (data: Uint8Array): Promise<string> =>
      ipcRenderer.invoke('utils:uint8ArrayToHex', data),
  },
  accounts: {
    getAll: (userId: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:getAll', userId),
    add: (userId: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, nickname),
    remove: (userId: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:remove', userId, accountId, nickname),
    changeNickname: (
      userId: string,
      accountId: string,
      nickname: string,
    ): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:changeNickname', userId, accountId, nickname),
  },
  files: {
    getAll: (userId: string): Promise<HederaFile[]> => ipcRenderer.invoke('files:getAll', userId),
    add: (file: Prisma.HederaFileUncheckedCreateInput): Promise<HederaFile[]> =>
      ipcRenderer.invoke('files:add', file),
    update: (
      fileId: string,
      userId: string,
      file: Prisma.HederaFileUncheckedUpdateInput,
    ): Promise<HederaFile[]> => ipcRenderer.invoke('files:update', fileId, userId, file),
    remove: (userId: string, fileId: string): Promise<HederaFile[]> =>
      ipcRenderer.invoke('files:remove', userId, fileId),
    showContentInTemp: (userId: string, fileId: string): Promise<void> =>
      ipcRenderer.invoke('files:showContentInTemp', userId, fileId),
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
    changePassword: (userId: string, oldPassword: string, newPassword: string): Promise<void> =>
      ipcRenderer.invoke('localUser:changePassword', userId, oldPassword, newPassword),
  },
  transactions: {
    setClient: (
      network: string,
      nodeAccountIds?: {
        [key: string]: string;
      },
      mirrorNetwork?: string[],
    ) => ipcRenderer.invoke('transactions:setClient', network, nodeAccountIds, mirrorNetwork),
    freezeTransaction: (transactionBytes: Uint8Array): Promise<Uint8Array> =>
      ipcRenderer.invoke('transactions:freezeTransaction', transactionBytes),
    signTransaction: (
      transactionBytes: Uint8Array,
      publicKeys: string[],
      userId: string,
      userPassword: string,
    ): Promise<Uint8Array> =>
      ipcRenderer.invoke(
        'transactions:signTransaction',
        transactionBytes,
        publicKeys,
        userId,
        userPassword,
      ),
    executeTransaction: (
      transactionBytes: Uint8Array,
    ): Promise<{ responseJSON: string; receiptBytes: Uint8Array }> =>
      ipcRenderer.invoke('transactions:executeTransaction', transactionBytes),
    executeQuery: (
      queryBytes: Uint8Array,
      accountId: string,
      privateKey: string,
      privateKeyType: string,
    ) =>
      ipcRenderer.invoke(
        'transactions:executeQuery',
        queryBytes,
        accountId,
        privateKey,
        privateKeyType,
      ),
    storeTransaction: (
      transaction: Prisma.TransactionUncheckedCreateInput,
    ): Promise<Transaction[]> => ipcRenderer.invoke('transactions:storeTransaction', transaction),
    getTransactions: (findArgs: Prisma.TransactionFindManyArgs): Promise<Transaction[]> =>
      ipcRenderer.invoke('transactions:getTransactions', findArgs),
    encodeSpecialFile: (content: Uint8Array, fileId: string) =>
      ipcRenderer.invoke('transactions:encodeSpecialFile', content, fileId),
  },
  transactionDrafts: {
    getDrafts: (findArgs: Prisma.TransactionDraftFindManyArgs): Promise<TransactionDraft[]> =>
      ipcRenderer.invoke('transactionDrafts:getDrafts', findArgs),
    getDraft: (id: string): Promise<TransactionDraft> =>
      ipcRenderer.invoke('transactionDrafts:getDraft', id),
    addDraft: (draft: Prisma.TransactionDraftUncheckedCreateInput): Promise<void> =>
      ipcRenderer.invoke('transactionDrafts:addDraft', draft),
    updateDraft: (id: string, draft: Prisma.TransactionDraftUncheckedUpdateInput): Promise<void> =>
      ipcRenderer.invoke('transactionDrafts:updateDraft', id, draft),
    deleteDraft: (id: string): Promise<void> =>
      ipcRenderer.invoke('transactionDrafts:deleteDraft', id),
    draftExists: (transactionBytes: string): Promise<boolean> =>
      ipcRenderer.invoke('transactionDrafts:draftExists', transactionBytes),
  },
};
typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
