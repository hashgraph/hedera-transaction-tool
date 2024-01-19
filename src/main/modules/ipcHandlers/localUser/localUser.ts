import { ipcMain } from 'electron';

import { login, register, resetData, hasRegisteredUsers } from '../../../services/localUser';

const createChannelName = (...props) => ['localUser', ...props].join(':');

export default (app: Electron.App) => {
  /* Local User */

  // Login
  ipcMain.handle(
    createChannelName('login'),
    async (_e, email: string, password: string, autoRegister?: boolean) => {
      await login(app.getPath('userData'), email, password, autoRegister);
    },
  );

  // Register
  ipcMain.handle(createChannelName('register'), (_e, email: string, password: string) =>
    register(email, password),
  );

  // Reset
  ipcMain.handle(
    createChannelName('resetData'),
    (
      _e,
      options?: {
        email: string;
        authData?: boolean;
        keys?: boolean;
        transactions?: boolean;
        organizations?: boolean;
      },
    ) => resetData(app.getPath('userData'), options),
  );

  // Check if user has been registered
  ipcMain.handle(createChannelName('hasRegisteredUsers'), () =>
    hasRegisteredUsers(app.getPath('userData')),
  );
};
