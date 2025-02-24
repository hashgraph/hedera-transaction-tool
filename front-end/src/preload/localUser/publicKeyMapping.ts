import type { PublicKeyMapping } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
  publicKeyMapping: {
    getPublicKeys: (): Promise<PublicKeyMapping[]> => ipcRenderer.invoke('publicKeyMapping:getAll'),
    addPublicKey: (publicKey: string, nickname: string): Promise<PublicKeyMapping> =>
      ipcRenderer.invoke('publicKeyMapping:add', publicKey, nickname),
    getPublicKey: (publicKey: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:get', publicKey),
    updatePublicKeyNickname: (
      publicKey: string,
      newNickname: string,
    ): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:updateNickname', publicKey, newNickname),
    deletePublicKey: (publicKey: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:delete', publicKey),
  },
};
