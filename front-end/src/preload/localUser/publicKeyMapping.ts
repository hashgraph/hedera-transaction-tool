import type { PublicKeyMapping } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
  publicKeyMapping: {
    getPublicKeys: (): Promise<PublicKeyMapping[]> => ipcRenderer.invoke('publicKeyMapping:getAll'),
    addPublicKey: (publicKey: string, nickname: string): Promise<PublicKeyMapping> =>
      ipcRenderer.invoke('publicKeyMapping:add', publicKey, nickname),
    getPublicKey: (publicKey: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:get', publicKey),
    updatePublicKeyNickname: (id: string, newNickname: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:updateNickname', id, newNickname),
    deletePublicKey: (id: string): Promise<PublicKeyMapping | null> =>
      ipcRenderer.invoke('publicKeyMapping:delete', id),
    searchPublicKeys: (filePaths: string[]): Promise<{ publicKey: string; nickname: string }[]> =>
      ipcRenderer.invoke('publicKeyMapping:searchPublicKeys', filePaths),
    searchPublicKeysAbort: () => ipcRenderer.send('publicKeyMapping:searchPublicKeys:abort'),
  },
};
