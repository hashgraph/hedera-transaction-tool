import {
  changePassword,
  comparePasswords,
  getUsersCount,
  login,
  register,
  resetData,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Local User */
  createIPCChannel('localUser', [
    renameFunc(login, 'login'),
    renameFunc(register, 'register'),
    renameFunc(resetData, 'resetData'),
    renameFunc(comparePasswords, 'comparePasswords'),
    renameFunc(changePassword, 'changePassword'),
    renameFunc(getUsersCount, 'usersCount'),
  ]);
};
