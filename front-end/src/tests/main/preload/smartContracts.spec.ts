import { vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('electron', () => ({ ipcRenderer: { invoke } }));

import smartContractsAPI from '@main/../preload/localUser/smartContracts';
import localAPI from '@main/../preload/localUser';

describe('preload smartContracts API', () => {
  const api = smartContractsAPI.smartContracts;

  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue('result');
  });

  test('getAll invokes smartContracts:getAll with find args', async () => {
    const args = { where: { user_id: 'u' } };
    expect(await api.getAll(args)).toBe('result');
    expect(invoke).toHaveBeenCalledWith('smartContracts:getAll', args);
  });

  test('getOne invokes smartContracts:getOne with user and id', async () => {
    await api.getOne('u', 'id');
    expect(invoke).toHaveBeenCalledWith('smartContracts:getOne', 'u', 'id');
  });

  test('add invokes smartContracts:add with the contract', async () => {
    const c = { user_id: 'u', network: 'testnet' } as never;
    await api.add(c);
    expect(invoke).toHaveBeenCalledWith('smartContracts:add', c);
  });

  test('update invokes smartContracts:update with id, user and patch in order', async () => {
    await api.update('id', 'u', { nickname: 'n' });
    expect(invoke).toHaveBeenCalledWith('smartContracts:update', 'id', 'u', { nickname: 'n' });
  });

  test('remove invokes smartContracts:remove with user and ids', async () => {
    await api.remove('u', ['a']);
    expect(invoke).toHaveBeenCalledWith('smartContracts:remove', 'u', ['a']);
  });

  test('is exposed through the aggregated local preload API', () => {
    expect(localAPI.smartContracts).toBe(api);
  });
});
