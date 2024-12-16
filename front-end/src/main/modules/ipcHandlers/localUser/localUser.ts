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
    login,
    register,
    resetData,
    comparePasswords,
    changePassword,
    renameFunc(getUsersCount, 'usersCount'),
  ]);
};
