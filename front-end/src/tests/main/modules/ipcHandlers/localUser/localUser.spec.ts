import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerLocalUserHandlers from '@main/modules/ipcHandlers/localUser/localUser';

import {
  changePassword,
  comparePasswords,
  getUsersCount,
  login,
  register,
  resetData,
} from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers localUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerLocalUserHandlers();
  });

  const userId = 'user1';
  const email = 'user@example.com';
  const password = 'password';
  const oldPassword = 'oldPassword';
  const newPassword = 'newPassword';

  test('Should register handlers for each event', () => {
    const event = [
      'login',
      'register',
      'resetData',
      'usersCount',
      'comparePasswords',
      'changePassword',
    ];
    expect(event.every(util => getIPCHandler(`localUser:${util}`))).toBe(true);
  });

  test('Should set up login handler', async () => {
    const autoRegister = true;

    await invokeIPCHandler('localUser:login', email, password, autoRegister);
    expect(login).toHaveBeenCalledWith(email, password, autoRegister);
  });

  test('Should set up register handler', async () => {
    await invokeIPCHandler('localUser:register', email, password);
    expect(register).toHaveBeenCalledWith(email, password);
  });

  test('Should set up resetData handler', async () => {
    await invokeIPCHandler('localUser:resetData');
    expect(resetData).toHaveBeenCalled();
  });

  test('Should set up usersCount handler', async () => {
    await invokeIPCHandler('localUser:usersCount');
    expect(getUsersCount).toHaveBeenCalled();
  });

  test('Should set up comparePasswords handler', async () => {
    await invokeIPCHandler('localUser:comparePasswords', userId, password);
    expect(comparePasswords).toHaveBeenCalledWith(userId, password);
  });

  test('Should set up changePassword handler', async () => {
    await invokeIPCHandler('localUser:changePassword', userId, oldPassword, newPassword);
    expect(changePassword).toHaveBeenCalledWith(userId, oldPassword, newPassword);
  });
});
