import { beforeEach, describe, expect, test, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ ipcRenderer: { invoke } }));
vi.mock('@prisma/client', () => ({ Prisma: {} }));

import accountsAPI from '../../../preload/localUser/accounts';

// These channel names and argument orders must match the handlers registered in
// src/main/modules/ipcHandlers/localUser/accounts.ts (covered by its own spec).
describe('preload accounts API', () => {
  const { accounts } = accountsAPI;

  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue('result');
  });

  test('getAll invokes accounts:getAll with the find args', async () => {
    const findArgs = { where: { user_id: 'u1' } };
    await expect(accounts.getAll(findArgs)).resolves.toBe('result');
    expect(invoke).toHaveBeenCalledWith('accounts:getAll', findArgs);
  });

  test('getOne invokes accounts:getOne with userId and accountId', async () => {
    await accounts.getOne('u1', '0.0.1001');
    expect(invoke).toHaveBeenCalledWith('accounts:getOne', 'u1', '0.0.1001');
  });

  test('add invokes accounts:add with userId, accountId, network and nickname in order', async () => {
    await accounts.add('u1', '0.0.1001', 'testnet', 'nick');
    expect(invoke).toHaveBeenCalledWith('accounts:add', 'u1', '0.0.1001', 'testnet', 'nick');
  });

  test('remove invokes accounts:remove with userId and accountIds', async () => {
    await accounts.remove('u1', ['0.0.1001', '0.0.1002']);
    expect(invoke).toHaveBeenCalledWith('accounts:remove', 'u1', ['0.0.1001', '0.0.1002']);
  });

  test('changeNickname invokes accounts:changeNickname with userId, accountId and nickname', async () => {
    await accounts.changeNickname('u1', '0.0.1001', 'nick');
    expect(invoke).toHaveBeenCalledWith('accounts:changeNickname', 'u1', '0.0.1001', 'nick');
  });

  test('propagates IPC rejections to the caller', async () => {
    invoke.mockRejectedValue(new Error('Account ID or Nickname already exists!'));
    await expect(accounts.add('u1', '0.0.1001', 'testnet', '')).rejects.toThrow(
      'Account ID or Nickname already exists!',
    );
  });
});
