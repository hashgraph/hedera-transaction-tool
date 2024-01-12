import { ipcMain } from 'electron';

import { login, register, resetData } from '../../../services/localUser';

const createChannelName = (...props) => ['localUser', ...props].join(':');

export default () => {
  /* Local User */

  // Login
  ipcMain.handle(
    createChannelName('login'),
    async (_e, email: string, password: string, autoRegister?: boolean) => {
      try {
        await login(email, password, autoRegister);
        return true;
      } catch (error) {
        return false;
      }
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
      email: string,
      options: {
        authData?: boolean;
        keys?: boolean;
        transactions?: boolean;
        organizations?: boolean;
      },
    ) => resetData(email, options),
  );
};
