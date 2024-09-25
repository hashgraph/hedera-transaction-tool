import type { User } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
  safeStorage: {
    isKeychainAvailable: (): Promise<boolean> =>
      ipcRenderer.invoke('safeStorage:isKeychainAvailable'),
    initializeUseKeychain: (useKeychain: boolean): Promise<void> =>
      ipcRenderer.invoke('safeStorage:initializeUseKeychain', useKeychain),
    getUseKeychain: (): Promise<boolean> => ipcRenderer.invoke('safeStorage:getUseKeychain'),
    getStaticUser: (): Promise<User> => ipcRenderer.invoke('safeStorage:getStaticUser'),
    encrypt: (data: string): Promise<string> => ipcRenderer.invoke('safeStorage:encrypt', data),
    decrypt: (data: string, encoding?: BufferEncoding): Promise<string> =>
      ipcRenderer.invoke('safeStorage:decrypt', data, encoding),
  },
};
