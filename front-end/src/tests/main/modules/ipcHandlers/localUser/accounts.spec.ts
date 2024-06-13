import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerAccountsHandlers from '@main/modules/ipcHandlers/localUser/accounts';

import { Prisma } from '@prisma/client';
import { Network } from '@main/shared/enums';
import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccounts,
} from '@main/services/localUser/accounts';
import { ipcMain } from 'electron';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser/accounts', () => ({
  getAccounts: vi.fn(),
  addAccount: vi.fn(),
  removeAccounts: vi.fn(),
  changeAccountNickname: vi.fn(),
}));

describe('IPC handlers Accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAccountsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const utils = ['getAll', 'add', 'remove', 'changeNickname'];

    expect(
      utils.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `accounts:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up getAll handler', async () => {
    const getAllHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'accounts:getAll');
    expect(getAllHandler).toBeDefined();

    const findArgs: Prisma.HederaAccountFindManyArgs = {};

    getAllHandler && (await getAllHandler[1](event, findArgs));
    expect(getAccounts).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up add handler', async () => {
    const addHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'accounts:add');
    expect(addHandler).toBeDefined();

    const userId = 'user1';
    const accountId = 'account1';
    const network = Network.TESTNET;
    const nickname = 'nickname';

    addHandler && (await addHandler[1](event, userId, accountId, network, nickname));
    expect(addAccount).toHaveBeenCalledWith(userId, accountId, network, nickname);
  });

  test('Should set up remove handler', async () => {
    const removeHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'accounts:remove');
    expect(removeHandler).toBeDefined();

    const userId = 'user1';
    const accountIds = ['account1'];

    removeHandler && (await removeHandler[1](event, userId, accountIds));
    expect(removeAccounts).toHaveBeenCalledWith(userId, accountIds);
  });

  test('Should set up changeNickname handler', async () => {
    const changeNicknameHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'accounts:changeNickname',
    );
    expect(changeNicknameHandler).toBeDefined();

    const userId = 'user1';
    const accountId = 'account1';
    const nickname = 'nickname';

    changeNicknameHandler && (await changeNicknameHandler[1](event, userId, accountId, nickname));
    expect(changeAccountNickname).toHaveBeenCalledWith(userId, accountId, nickname);
  });
});
