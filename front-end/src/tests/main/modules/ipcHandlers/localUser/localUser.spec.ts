import { ipcMain } from 'electron';

import registerLocalUserHandlers from '@main/modules/ipcHandlers/localUser/localUser';

import {
  changePassword,
  comparePasswords,
  getUsersCount,
  login,
  register,
  resetData,
} from '@main/services/localUser';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  changePassword: vi.fn(),
  comparePasswords: vi.fn(),
  getUsersCount: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  resetData: vi.fn(),
}));

describe('IPC handlers localUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerLocalUserHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const event = ['register', 'resetData', 'usersCount', 'comparePasswords', 'changePassword'];

    expect(
      event.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `localUser:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up login handler', async () => {
    const loginHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'localUser:login');
    expect(loginHandler).toBeDefined();

    const email = 'user@example.com';
    const password = 'password';
    const autoRegister = true;

    loginHandler && (await loginHandler[1](event, email, password, autoRegister));
    expect(login).toHaveBeenCalledWith(email, password, autoRegister);
  });

  test('Should set up register handler', async () => {
    const registerHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'localUser:register');
    expect(registerHandler).toBeDefined();

    const email = 'user@example.com';
    const password = 'password';

    registerHandler && (await registerHandler[1](event, email, password));
    expect(register).toHaveBeenCalledWith(email, password);
  });

  test('Should set up resetData handler', async () => {
    const resetDataHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'localUser:resetData');
    expect(resetDataHandler).toBeDefined();

    resetDataHandler && (await resetDataHandler[1](event));
    expect(resetData).toHaveBeenCalled();
  });

  test('Should set up usersCount handler', async () => {
    const usersCountHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'localUser:usersCount',
    );
    expect(usersCountHandler).toBeDefined();

    usersCountHandler && (await usersCountHandler[1](event));
    expect(getUsersCount).toHaveBeenCalled();
  });

  test('Should set up comparePasswords handler', async () => {
    const comparePasswordsHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'localUser:comparePasswords',
    );
    expect(comparePasswordsHandler).toBeDefined();

    const userId = 'user1';
    const password = 'password';

    comparePasswordsHandler && (await comparePasswordsHandler[1](event, userId, password));
    expect(comparePasswords).toHaveBeenCalledWith(userId, password);
  });

  test('Should set up changePassword handler', async () => {
    const changePasswordHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'localUser:changePassword',
    );
    expect(changePasswordHandler).toBeDefined();

    const userId = 'user1';
    const oldPassword = 'oldPassword';
    const newPassword = 'newPassword';

    changePasswordHandler &&
      (await changePasswordHandler[1](event, userId, oldPassword, newPassword));
    expect(changePassword).toHaveBeenCalledWith(userId, oldPassword, newPassword);
  });
});
