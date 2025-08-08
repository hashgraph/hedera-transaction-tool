import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerAccountsHandlers from '@main/modules/ipcHandlers/localUser/accounts';

import { Prisma } from '@prisma/client';
import { CommonNetwork } from '@shared/enums';
import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccounts,
} from '@main/services/localUser/accounts';

vi.mock('@main/services/localUser/accounts', () => mockDeep());

describe('IPC handlers Accounts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerAccountsHandlers();
  });

  const userId = 'user1';
  const accountId = 'account1';
  const accountIds = ['account1'];
  const nickname = 'nickname';

  test('Should register handlers for each event', () => {
    const events = ['getAll', 'add', 'remove', 'changeNickname'];
    expect(events.every(e => getIPCHandler(`accounts:${e}`))).toBe(true);
  });

  test('Should set up getAll handler', async () => {
    const findArgs: Prisma.HederaAccountFindManyArgs = {};
    await invokeIPCHandler('accounts:getAll', findArgs);
    expect(getAccounts).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up add handler', async () => {
    const network = CommonNetwork.TESTNET;

    await invokeIPCHandler('accounts:add', userId, accountId, network, nickname);
    expect(addAccount).toHaveBeenCalledWith(userId, accountId, network, nickname);
  });

  test('Should set up remove handler', async () => {
    await invokeIPCHandler('accounts:remove', userId, accountIds);
    expect(removeAccounts).toHaveBeenCalledWith(userId, accountIds);
  });

  test('Should set up changeNickname handler', async () => {
    await invokeIPCHandler('accounts:changeNickname', userId, accountId, nickname);
    expect(changeAccountNickname).toHaveBeenCalledWith(userId, accountId, nickname);
  });
});
