import path from 'path';

import { expect, vi } from 'vitest';

import { HederaFile } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  addFile,
  deleteAllTempFolders,
  deleteTempFolder,
  getFiles,
  removeFiles,
  showStoredFileInTemp,
  updateFile,
} from '@main/services/localUser/files';

import { CommonNetwork } from '@shared/enums';
import { saveContentToPath, getNumberArrayFromString, deleteDirectory } from '@main/utils';
import { safeAwait } from '@main/utils/safeAwait';

import { app, shell } from 'electron';

vi.mock('@main/db/prisma');
vi.mock('@main/utils', () => ({
  saveContentToPath: vi.fn(),
  getNumberArrayFromString: vi.fn(),
  deleteDirectory: vi.fn(),
}));
vi.mock('@main/utils/safeAwait');
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '') },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));
describe('Services Local User Files', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const file: HederaFile = {
    id: '321',
    user_id: '123',
    file_id: '0.0.111',
    nickname: 'special',
    network: CommonNetwork.TESTNET,
    contentBytes: '0x123',
    metaBytes: '0x456',
    lastRefreshed: new Date(),
    description: 'A description',
    created_at: new Date(),
  };

  describe('getFiles', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should get the files by a find arguments', async () => {
      prisma.hederaFile.findMany.mockResolvedValueOnce([file]);

      const result = await getFiles({});

      expect(prisma.hederaFile.findMany).toBeCalledWith({});
      expect(result).toEqual([file]);
    });

    test('Should return empty array on error', async () => {
      prisma.hederaFile.findMany.mockImplementationOnce(() => {
        throw new Error('Database Error');
      });

      const result = await getFiles({});

      expect(result).toEqual([]);
    });
  });

  describe('addFile', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a file with provided arguments', async () => {
      prisma.hederaFile.count.mockResolvedValueOnce(0);
      prisma.hederaFile.findMany.mockResolvedValueOnce([file]);

      const result = await addFile(file);

      expect(result).toStrictEqual([file]);
    });

    test('Should add a file with provided arguments without nickname', async () => {
      prisma.hederaFile.count.mockResolvedValueOnce(0);
      prisma.hederaFile.findMany.mockResolvedValueOnce([{ ...file, nickname: '' }]);

      const result = await addFile({ ...file, nickname: '' });

      expect(result).toStrictEqual([{ ...file, nickname: '' }]);
    });

    test('Should throw error if file already exists', async () => {
      prisma.hederaFile.count.mockResolvedValueOnce(1);

      expect(addFile(file)).rejects.toThrowError('File ID or Nickname already exists!');
    });
  });

  describe('removeFiles', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should remove files by userId and fileIds', async () => {
      const userId: string = '123';
      const fileIds: string[] = ['0.0.2', '0.0.3'];

      await removeFiles(userId, fileIds);

      expect(prisma.hederaFile.deleteMany).toHaveBeenCalledOnce();
    });
  });

  describe('updateFile', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call the prisma updateMany with the correct parameters', async () => {
      await updateFile('1', 'user1', file);

      expect(prisma.hederaFile.updateMany).toHaveBeenCalledWith({
        where: { file_id: '1', user_id: 'user1' },
        data: { ...file, user_id: 'user1' },
      });
    });

    test('Should remove the nickname of a file', async () => {
      await updateFile('1', 'user1', { ...file, nickname: '  ' });

      expect(prisma.hederaFile.updateMany).toHaveBeenCalledWith({
        where: { file_id: '1', user_id: 'user1' },
        data: { ...file, nickname: null, user_id: 'user1' },
      });
    });
  });

  describe('showStoredFileInTemp', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should retrieve the file, save its content, and open it', async () => {
      const tempPath = '/tmp';
      const filePath = path.join(tempPath, 'electronHederaFiles', `${file.file_id}.txt`);

      prisma.hederaFile.findFirst.mockResolvedValue(file);
      vi.mocked(app.getPath).mockReturnValue(tempPath);
      vi.mocked(saveContentToPath).mockResolvedValue(true);
      vi.mocked(getNumberArrayFromString).mockReturnValue([1, 2, 3]);
      await showStoredFileInTemp(file.user_id, file.file_id);

      expect(prisma.hederaFile.findFirst).toHaveBeenCalledWith({
        where: { user_id: file.user_id, file_id: file.file_id },
      });
      expect(saveContentToPath).toHaveBeenCalledWith(filePath, Buffer.from([1, 2, 3]));
      expect(shell.showItemInFolder).toHaveBeenCalledWith(filePath);
      expect(shell.openPath).toHaveBeenCalledWith(filePath);
    });

    test('Should throw error if file is not found', async () => {
      prisma.hederaFile.findFirst.mockRejectedValueOnce('File not found');

      await expect(showStoredFileInTemp(file.user_id, file.file_id)).rejects.toThrowError(
        'File not found',
      );
    });

    test('Should throw error if file has no content', async () => {
      prisma.hederaFile.findFirst.mockResolvedValue({ ...file, contentBytes: null });

      await expect(showStoredFileInTemp(file.user_id, file.file_id)).rejects.toThrowError(
        'File content is unknown',
      );
    });

    test('Should throw error if file cannot be saved to path', async () => {
      const tempPath = '/tmp';

      prisma.hederaFile.findFirst.mockResolvedValue(file);
      vi.mocked(app.getPath).mockReturnValue(tempPath);
      vi.mocked(saveContentToPath).mockRejectedValue('An error');
      vi.mocked(getNumberArrayFromString).mockReturnValue([1, 2, 3]);

      await expect(showStoredFileInTemp(file.user_id, file.file_id)).rejects.toThrowError(
        'Failed to open file content',
      );
    });
  });

  describe('deleteTempFolder', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should invoke deleteDirectory with the correct path', async () => {
      const tempPath = '/tmp';

      vi.mocked(app.getPath).mockReturnValue(tempPath);

      await deleteTempFolder('electronHederaFiles');

      expect(deleteDirectory).toHaveBeenCalledWith(path.join(tempPath, 'electronHederaFiles'));
    });

    test('Should do nothing if deleteDirectory fails', async () => {
      vi.mocked(app.getPath).mockReturnValue('/tmp');
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: new Error('An error') });

      const result = await deleteTempFolder('electronHederaFiles');

      expect(result).toBeUndefined();
    });
  });

  describe('deleteAllTempFolders', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete all temp folders', async () => {
      const tempPath = '/tmp';

      vi.mocked(app.getPath).mockReturnValue(tempPath);

      await deleteAllTempFolders();

      expect(deleteDirectory).toHaveBeenNthCalledWith(
        1,
        path.join(tempPath, 'electronHederaFiles'),
      );
      expect(deleteDirectory).toHaveBeenNthCalledWith(2, path.join(tempPath, 'encryptedKeys'));
    });

    test('Should do nothing if deleteDirectory fails', async () => {
      vi.mocked(app.getPath).mockReturnValue('/tmp');
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: new Error('An error') });

      const result = await deleteAllTempFolders();

      expect(result).toBeUndefined();
    });
  });
});
