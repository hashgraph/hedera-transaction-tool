import type { KeyPair } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  keyPairs: {
    getAll: (userId: string, decryptPassword: string | null, organizationId?: string | null): Promise<KeyPair[]> =>
      ipcRenderer.invoke('keyPairs:getAll', userId, decryptPassword, organizationId),
    store: (
      keyPair: Prisma.KeyPairUncheckedCreateInput,
      password: string | null,
      encrypted: boolean,
    ): Promise<void> => ipcRenderer.invoke('keyPairs:store', keyPair, password, encrypted),
    changeDecryptionPassword: (
      userId: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<KeyPair[]> =>
      ipcRenderer.invoke('keyPairs:changeDecryptionPassword', userId, oldPassword, newPassword),
    decryptPrivateKey: (
      userId: string,
      password: string | null,
      publicKey: string,
    ): Promise<string> =>
      ipcRenderer.invoke('keyPairs:decryptPrivateKey', userId, password, publicKey),
    deleteEncryptedPrivateKeys: (userId: string, decryptPassword: string | null, organizationId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', userId, decryptPassword, organizationId),
    clear: (userId: string, decryptPassword: string | null, organizationId?: string): Promise<boolean> =>
      ipcRenderer.invoke('keyPairs:clear', userId, decryptPassword, organizationId),
    deleteKeyPair: (keyPairId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteKeyPair', keyPairId),
    updateNickname: (keyPairId: string, nickname: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:updateNickname', keyPairId, nickname),
    updateMnemonicHash: (keyPairId: string, mnemonicHash: string | null): Promise<void> =>
      ipcRenderer.invoke('keyPairs:updateMnemonicHash', keyPairId, mnemonicHash),
    updateIndex: (keyPairId: string, index: number): Promise<void> =>
      ipcRenderer.invoke('keyPairs:updateIndex', keyPairId, index),
  },
};
