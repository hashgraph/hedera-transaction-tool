// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { add, getAll, getOne, remove, update } from '@renderer/services/smartContractsService';

const api = {
  getAll: vi.fn(),
  getOne: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('smartContractsService', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetAllMocks();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      local: { smartContracts: api },
    };
  });

  test('getAll forwards args and returns the result', async () => {
    api.getAll.mockResolvedValue(['c']);
    expect(await getAll({ where: { user_id: 'u' } })).toEqual(['c']);
    expect(api.getAll).toHaveBeenCalledWith({ where: { user_id: 'u' } });
  });

  test('getOne forwards args', async () => {
    api.getOne.mockResolvedValue('c');
    expect(await getOne('u', 'id')).toBe('c');
    expect(api.getOne).toHaveBeenCalledWith('u', 'id');
  });

  test('add forwards the contract', async () => {
    api.add.mockResolvedValue(['c']);
    const contract = { user_id: 'u', network: 'testnet' } as never;
    expect(await add(contract)).toEqual(['c']);
    expect(api.add).toHaveBeenCalledWith(contract);
  });

  test('update forwards id, user and patch', async () => {
    api.update.mockResolvedValue(['c']);
    expect(await update('id', 'u', { nickname: 'n' })).toEqual(['c']);
    expect(api.update).toHaveBeenCalledWith('id', 'u', { nickname: 'n' });
  });

  test('remove forwards user and ids', async () => {
    api.remove.mockResolvedValue(undefined);
    await remove('u', ['a']);
    expect(api.remove).toHaveBeenCalledWith('u', ['a']);
  });

  test.each([
    ['getAll', () => getAll({}), 'Failed to get smart contracts'],
    ['getOne', () => getOne('u', 'i'), 'Failed to get the smart contract'],
    ['add', () => add({} as never), 'Smart contract save failed'],
    ['update', () => update('i', 'u', {}), 'Smart contract update failed'],
    ['remove', () => remove('u', []), 'Smart contract removal failed'],
  ])('%s throws the default message when the IPC call fails', async (name, call, message) => {
    api[name as keyof typeof api].mockRejectedValue(new Error('boom'));
    await expect(call()).rejects.toThrow(message);
  });
});
