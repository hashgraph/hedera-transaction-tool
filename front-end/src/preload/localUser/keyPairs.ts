import type { KeyPair } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  keyPairs: {
    getAll: (userId: string, organizationId?: string | null): Promise<KeyPair[]> =>
      ipcRenderer.invoke('keyPairs:getAll', userId, organizationId),
    getSecretHashes: (userId: string, organizationId?: string | null): Promise<string[]> =>
      ipcRenderer.invoke('keyPairs:getSecretHashes', userId, organizationId),
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
    deleteEncryptedPrivateKeys: (userId: string, organizationId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteEncryptedPrivateKeys', userId, organizationId),
    clear: (userId: string, organizationId?: string): Promise<boolean> =>
      ipcRenderer.invoke('keyPairs:clear', userId, organizationId),
    deleteKeyPair: (keyPairId: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:deleteKeyPair', keyPairId),
    updateNickname: (keyPairId: string, nickname: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:updateNickname', keyPairId, nickname),
    updateMnemonicHash: (keyPairId: string, mnemonicHash: string): Promise<void> =>
      ipcRenderer.invoke('keyPairs:updateMnemonicHash', keyPairId, mnemonicHash),
  },
};
