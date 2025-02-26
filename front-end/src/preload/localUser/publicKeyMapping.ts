import type { PublicKeyMapping } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
  publicKeyMapping: {
    getPublicKeys: (): Promise<PublicKeyMapping[]> =>
      ipcRenderer.invoke('publicKeyMapping:getPublicKeys'),
    addPublicKey: (publicKey: string, nickname: string): Promise<PublicKeyMapping> =>
      ipcRenderer.invoke('publicKeyMapping:addPublickey', publicKey, nickname),
    getPublicKey: (publicKey: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:getPublicKey', publicKey),
    updatePublicKeyNickname: (
      publicKey: string,
      newNickname: string,
    ): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:updatePublicKeyNickname', publicKey, newNickname),
    deletePublicKey: (publicKey: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:deletePublicKey', publicKey),
  },
};
