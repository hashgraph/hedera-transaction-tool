import type { ComplexKey } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
  complexKeys: {
    add: (userId: string, keyListBytes: Uint8Array, nickname: string): Promise<ComplexKey> =>
      ipcRenderer.invoke('complexKeys:add', userId, keyListBytes, nickname),
    getAll: (userId: string): Promise<ComplexKey[]> =>
      ipcRenderer.invoke('complexKeys:getAll', userId),
    getComplexKey: (userId: string, keyListBytes: Uint8Array): Promise<ComplexKey> =>
      ipcRenderer.invoke('complexKeys:getComplexKey', userId, keyListBytes),
    delete: (id: string): Promise<ComplexKey[]> => ipcRenderer.invoke('complexKeys:delete', id),
    update: (id: string, newKeyListBytes: Uint8Array): Promise<ComplexKey> =>
      ipcRenderer.invoke('complexKeys:update', id, newKeyListBytes),
  },
};
