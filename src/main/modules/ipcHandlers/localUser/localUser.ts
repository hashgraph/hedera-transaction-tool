import { ipcMain } from 'electron';

import { getUsersCount, login, register, resetData } from '../../../services/localUser';

const createChannelName = (...props) => ['localUser', ...props].join(':');

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
};
