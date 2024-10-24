import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerFilesHandlers from '@main/modules/ipcHandlers/localUser/files';

import { Prisma } from '@prisma/client';
import { CommonNetwork } from '@main/shared/enums';
import {
  addFile,
  getFiles,
  removeFiles,
  showStoredFileInTemp,
  updateFile,
} from '@main/services/localUser/files';
import { ipcMain } from 'electron';
import { decodeProto } from '@main/utils/hederaSpecialFiles';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser/files', () => ({
  addFile: vi.fn(),
  getFiles: vi.fn(),
  removeFiles: vi.fn(),
  showStoredFileInTemp: vi.fn(),
  updateFile: vi.fn(),
}));
vi.mock('@main/utils/hederaSpecialFiles', () => ({
  decodeProto: vi.fn(),
}));

describe('IPC handlers Files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerFilesHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = ['getAll', 'add', 'remove', 'update', 'showStoredFileInTemp'];

    expect(
      events.every(e => ipcMainMO.handle.mock.calls.some(([channel]) => channel === `files:${e}`)),
    ).toBe(true);
  });

  test('Should set up getAll handler', async () => {
    const getAllHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'files:getAll');
    expect(getAllHandler).toBeDefined();

    const findArgs: Prisma.HederaAccountFindManyArgs = {};

    getAllHandler && (await getAllHandler[1](event, findArgs));
    expect(getFiles).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up add handler', async () => {
    const addHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'files:add');
    expect(addHandler).toBeDefined();

    const file: Prisma.HederaFileUncheckedCreateInput = {
      file_id: 'file1',
      user_id: 'user1',
      network: CommonNetwork.MAINNET,
    };

    addHandler && (await addHandler[1](event, file));
    expect(addFile).toHaveBeenCalledWith(file);
  });

  test('Should set up remove handler', async () => {
    const removeHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'files:remove');
    expect(removeHandler).toBeDefined();

    const userId = 'user1';
    const fileIds = ['filed1'];

    removeHandler && (await removeHandler[1](event, userId, fileIds));
    expect(removeFiles).toHaveBeenCalledWith(userId, fileIds);
  });

  test('Should set up showStoredFileInTemp handler', async () => {
    const showStoredFileInTempHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'files:showStoredFileInTemp',
    );
    expect(showStoredFileInTempHandler).toBeDefined();

    const userId = 'user1';
    const filedId = 'filed1';

    showStoredFileInTempHandler && (await showStoredFileInTempHandler[1](event, userId, filedId));
    expect(showStoredFileInTemp).toHaveBeenCalledWith(userId, filedId);
  });

  test('Should set up update handler', async () => {
    const updateHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'files:update');
    expect(updateHandler).toBeDefined();

    const userId = 'user1';
    const filedId = 'filed1';
    const file: Prisma.HederaFileUncheckedUpdateInput = {
      contentBytes: 'content',
    };

    updateHandler && (await updateHandler[1](event, userId, filedId, file));
    expect(updateFile).toHaveBeenCalledWith(userId, filedId, file);
  });

  test('Should set up decodeProto handler', async () => {
    const decodeProtoHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'files:decodeProto');
    expect(decodeProtoHandler).toBeDefined();

    const fileId = '0.0.111';
    const bytes = new Uint8Array([8, 1, 18, 1, 8, 1]);

    decodeProtoHandler && (await decodeProtoHandler[1](event, fileId, bytes));
    expect(decodeProto).toHaveBeenCalledWith(fileId, bytes);
  });
});
