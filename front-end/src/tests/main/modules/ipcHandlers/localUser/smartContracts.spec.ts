import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerSmartContractsHandlers from '@main/modules/ipcHandlers/localUser/smartContracts';

import {
  addSmartContract,
  getSmartContracts,
  removeSmartContracts,
  updateSmartContract,
} from '@main/services/localUser/smartContracts';

vi.mock('@main/services/localUser/smartContracts', () => mockDeep());

describe('IPC handlers Smart Contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerSmartContractsHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['getAll', 'add', 'update', 'remove'];
    expect(events.every(e => getIPCHandler(`smartContracts:${e}`))).toBe(true);
  });

  test('Should set up getAll handler', async () => {
    const args = { where: { user_id: 'u' } };
    await invokeIPCHandler('smartContracts:getAll', args);
    expect(getSmartContracts).toHaveBeenCalledWith(args);
  });

  test('Should set up add handler', async () => {
    const contract = { user_id: 'u', network: 'testnet', contract_id: '0.0.5' };
    await invokeIPCHandler('smartContracts:add', contract);
    expect(addSmartContract).toHaveBeenCalledWith(contract);
  });

  test('Should set up update handler', async () => {
    await invokeIPCHandler('smartContracts:update', 'id1', 'u', { nickname: 'n' });
    expect(updateSmartContract).toHaveBeenCalledWith('id1', 'u', { nickname: 'n' });
  });

  test('Should set up remove handler', async () => {
    await invokeIPCHandler('smartContracts:remove', 'u', ['id1']);
    expect(removeSmartContracts).toHaveBeenCalledWith('u', ['id1']);
  });
});
