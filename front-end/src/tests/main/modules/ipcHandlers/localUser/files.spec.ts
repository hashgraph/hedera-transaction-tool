import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerFilesHandlers from '@main/modules/ipcHandlers/localUser/files';

import { Prisma } from '@prisma/client';
import { CommonNetwork } from '@shared/enums';
import {
  addFile,
  getFiles,
  removeFiles,
  showStoredFileInTemp,
  updateFile,
} from '@main/services/localUser/files';
import { decodeProto } from '@shared/hederaSpecialFiles';

vi.mock('@main/services/localUser/files', () => mockDeep());
vi.mock('@shared/hederaSpecialFiles', () => mockDeep());

describe('IPC handlers Files', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerFilesHandlers();
  });

  const userId = 'user1';
  const fileId = '0.0.111';
  const fileIds = ['filed1'];

  test('Should register handlers for each event', () => {
    const events = ['getAll', 'add', 'remove', 'update', 'showStoredFileInTemp', 'decodeProto'];
    expect(events.every(e => getIPCHandler(`files:${e}`))).toBe(true);
  });

  test('Should set up getAll handler', async () => {
    const findArgs: Prisma.HederaAccountFindManyArgs = {};

    await invokeIPCHandler('files:getAll', findArgs);
    expect(getFiles).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up add handler', async () => {
    const file: Prisma.HederaFileUncheckedCreateInput = {
      file_id: 'file1',
      user_id: 'user1',
      network: CommonNetwork.MAINNET,
    };

    await invokeIPCHandler('files:add', file);
    expect(addFile).toHaveBeenCalledWith(file);
  });

  test('Should set up remove handler', async () => {
    await invokeIPCHandler('files:remove', userId, fileIds);
    expect(removeFiles).toHaveBeenCalledWith(userId, fileIds);
  });

  test('Should set up showStoredFileInTemp handler', async () => {
    await invokeIPCHandler('files:showStoredFileInTemp', userId, fileId);
    expect(showStoredFileInTemp).toHaveBeenCalledWith(userId, fileId);
  });

  test('Should set up update handler', async () => {
    const file: Prisma.HederaFileUncheckedUpdateInput = {
      contentBytes: 'content',
    };

    await invokeIPCHandler('files:update', userId, fileId, file);
    expect(updateFile).toHaveBeenCalledWith(userId, fileId, file);
  });

  test('Should set up decodeProto handler', async () => {
    const bytes = new Uint8Array([8, 1, 18, 1, 8, 1]);

    await invokeIPCHandler('files:decodeProto', fileId, bytes);
    expect(decodeProto).toHaveBeenCalledWith(fileId, bytes);
  });
});
