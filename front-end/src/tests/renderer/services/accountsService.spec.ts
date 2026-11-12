// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@prisma/client', () => ({ Prisma: {} }));

import { add, changeNickname, getAll, getOne, remove } from '@renderer/services/accountsService';

describe('accountsService', () => {
  let api: Record<
    'getAll' | 'getOne' | 'add' | 'remove' | 'changeNickname',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    api = {
      getAll: vi.fn().mockResolvedValue([]),
      getOne: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      changeNickname: vi.fn().mockResolvedValue([]),
    };
    (window as any).electronAPI = { local: { accounts: api } };
  });

  test('getAll forwards the find args', async () => {
    const findArgs = { where: { user_id: 'u1' } };
    await getAll(findArgs);
    expect(api.getAll).toHaveBeenCalledWith(findArgs);
  });

  test('getOne forwards userId and accountId', async () => {
    await getOne('u1', '0.0.1001');
    expect(api.getOne).toHaveBeenCalledWith('u1', '0.0.1001');
  });

  test('add forwards userId, accountId, network and nickname', async () => {
    await add('u1', '0.0.1001', 'testnet', 'nick');
    expect(api.add).toHaveBeenCalledWith('u1', '0.0.1001', 'testnet', 'nick');
  });

  test('add defaults the nickname to an empty string', async () => {
    await add('u1', '0.0.1001', 'testnet');
    expect(api.add).toHaveBeenCalledWith('u1', '0.0.1001', 'testnet', '');
  });

  test('remove forwards userId and accountIds', async () => {
    await remove('u1', ['0.0.1001']);
    expect(api.remove).toHaveBeenCalledWith('u1', ['0.0.1001']);
  });

  test('changeNickname forwards its arguments and defaults the nickname', async () => {
    await changeNickname('u1', '0.0.1001', 'nick');
    expect(api.changeNickname).toHaveBeenCalledWith('u1', '0.0.1001', 'nick');

    await changeNickname('u1', '0.0.1001');
    expect(api.changeNickname).toHaveBeenLastCalledWith('u1', '0.0.1001', '');
  });

  test('add surfaces the main-process error message', async () => {
    api.add.mockRejectedValue(
      new Error(
        "Error invoking remote method 'accounts:add': Error: Account ID or Nickname already exists!",
      ),
    );
    await expect(add('u1', '0.0.1001', 'testnet')).rejects.toThrow(
      'Account ID or Nickname already exists!',
    );
  });

  test('add falls back to the default message when the error has no usable message', async () => {
    api.add.mockRejectedValue(new Error('boom'));
    await expect(add('u1', '0.0.1001', 'testnet')).rejects.toThrow('Account link failed');
  });
});
