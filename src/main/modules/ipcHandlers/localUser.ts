import { ipcMain } from 'electron';

import { login, register, resetData } from '../../services/localUser';
import { ILocalUserData } from '../../shared/interfaces/ILocalUserData';

const createChannelName = (...props) => ['localUser', ...props].join(':');

export default () => {
  /* Local User */

  // Login
  ipcMain.handle(
    createChannelName('login'),
    async (_e, email: string, password: string, autoRegister?: boolean) => {
      const { isInitial } = await login(email, password, autoRegister);

      const userData: ILocalUserData = {
        email,
        isInitial,
      };

      return userData;
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
