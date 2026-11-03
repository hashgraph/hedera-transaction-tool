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
    checkKeychain: (): Promise<boolean> => ipcRenderer.invoke('safeStorage:checkKeychain'),
  },
};
