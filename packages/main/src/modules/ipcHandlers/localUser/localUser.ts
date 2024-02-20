import {ipcMain} from 'electron';

import {
  comparePasswords,
  getUsersCount,
  login,
  register,
  resetData,
} from '@main/services/localUser';

const createChannelName = (...props: string[]) => ['localUser', ...props].join(':');

export default () => {
  /* Local User */

  // Login
  ipcMain.handle(
    createChannelName('login'),
    (_e, email: string, password: string, autoRegister?: boolean) =>
      login(email, password, autoRegister),
  );

  // Register
  ipcMain.handle(createChannelName('register'), (_e, email: string, password: string) =>
    register(email, password),
  );

  // Reset
  ipcMain.handle(createChannelName('resetData'), () => resetData());

  // Check if user has been registered
  ipcMain.handle(createChannelName('usersCount'), () => getUsersCount());

  // Check if user's password matches a given one
  ipcMain.handle(createChannelName('comparePasswords'), (_e, userId: string, password: string) =>
    comparePasswords(userId, password),
  );
};
