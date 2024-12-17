import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerComplexKeysHandlers from '@main/modules/ipcHandlers/localUser/complexKeys';
import {
  addComplexKey,
  getComplexKeys,
  getComplexKey,
  deleteComplexKey,
  updateComplexKey,
} from '@main/services/localUser/complexKeys';

vi.mock('@main/services/localUser/complexKeys', () => mockDeep());

describe('IPC handlers complex keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerComplexKeysHandlers();
  });

  const userId = 'user1';
  const id = 'id1';
  const keyListBytes = new Uint8Array([1, 2, 3]);
  const nickname = 'nickname';

  test('Should register handlers for each event', () => {
    const event = ['add', 'getAll', 'getComplexKey', 'update', 'delete'];
    expect(event.every(util => getIPCHandler(`complexKeys:${util}`))).toBe(true);
  });

  test('Should set up add handler', async () => {
    await invokeIPCHandler('complexKeys:add', userId, keyListBytes, nickname);
    expect(addComplexKey).toHaveBeenCalledWith(userId, keyListBytes, nickname);
  });

  test('Should set up getAll handler', async () => {
    await invokeIPCHandler('complexKeys:getAll', userId);
    expect(getComplexKeys).toHaveBeenCalledWith(userId);
  });

  test('Should set up getComplexKey handler', async () => {
    await invokeIPCHandler('complexKeys:getComplexKey', userId, keyListBytes);
    expect(getComplexKey).toHaveBeenCalledWith(userId, keyListBytes);
  });

  test('Should set up delete handler', async () => {
    await invokeIPCHandler('complexKeys:delete', id);
    expect(deleteComplexKey).toHaveBeenCalledWith(id);
  });

  test('Should set up update handler', async () => {
    await invokeIPCHandler('complexKeys:update', id, keyListBytes);
    expect(updateComplexKey).toHaveBeenCalledWith(id, keyListBytes);
  });
});
