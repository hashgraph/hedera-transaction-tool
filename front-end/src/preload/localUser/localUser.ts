import type { User } from '@prisma/client';

import { ipcRenderer } from 'electron';

export default {
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
};
