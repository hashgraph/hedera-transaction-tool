import { ipcMain } from 'electron';

import registerComplexKeysHandlers from '@main/modules/ipcHandlers/localUser/complexKeys';
import {
  addComplexKey,
  getComplexKeys,
  getComplexKey,
  deleteComplexKey,
  updateComplexKey,
} from '@main/services/localUser/complexKeys';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser/complexKeys', () => ({
  addComplexKey: vi.fn(),
  getComplexKeys: vi.fn(),
  getComplexKey: vi.fn(),
  deleteComplexKey: vi.fn(),
  updateComplexKey: vi.fn(),
}));

describe('IPC handlers complex keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerComplexKeysHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should set up add handler', async () => {
    const addHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'complexKeys:add');
    expect(addHandler).toBeDefined();

    const userId = 'user1';
    const keyListBytes = new Uint8Array([1, 2, 3]);
    const nickname = 'nickname';

    addHandler && (await addHandler[1](event, userId, keyListBytes, nickname));
    expect(addComplexKey).toHaveBeenCalledWith(userId, keyListBytes, nickname);
  });

  test('Should set up getAll handler', async () => {
    const getAllHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'complexKeys:getAll');
    expect(getAllHandler).toBeDefined();

    const userId = 'user1';

    getAllHandler && (await getAllHandler[1](event, userId));
    expect(getComplexKeys).toHaveBeenCalledWith(userId);
  });

  test('Should set up getComplexKey handler', async () => {
    const getComplexKeyHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'complexKeys:getComplexKey',
    );
    expect(getComplexKeyHandler).toBeDefined();

    const userId = 'user1';
    const keyListBytes = new Uint8Array([1, 2, 3]);

    getComplexKeyHandler && (await getComplexKeyHandler[1](event, userId, keyListBytes));
    expect(getComplexKey).toHaveBeenCalledWith(userId, keyListBytes);
  });

  test('Should set up delete handler', async () => {
    const deleteHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'complexKeys:delete');
    expect(deleteHandler).toBeDefined();

    const id = 'id1';

    deleteHandler && (await deleteHandler[1](event, id));
    expect(deleteComplexKey).toHaveBeenCalledWith(id);
  });

  test('Should set up update handler', async () => {
    const updateHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'complexKeys:update');
    expect(updateHandler).toBeDefined();

    const id = 'id1';
    const newKeyListBytes = new Uint8Array([4, 5, 6]);

    updateHandler && (await updateHandler[1](event, id, newKeyListBytes));
    expect(updateComplexKey).toHaveBeenCalledWith(id, newKeyListBytes);
  });
});
