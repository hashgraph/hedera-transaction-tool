import { expect, vi } from 'vitest';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Dirent, Stats } from 'fs';
import { app } from 'electron';

import {
  searchPublicKeysAbort,
  PublicAbortable,
  PublicKeySearcher,
  getPublicKeys,
  addPublicKey,
  getPublicKey,
  updatePublicKeyNickname,
  deletePublicKey,
} from '@main/services/localUser/publicKeyMapping';
import { getPrismaClient } from '@main/db/prisma';
import { unzip } from '@main/utils/files';

vi.mock('fs/promises');
vi.mock('path');
vi.mock('electron', () => ({ app: { getPath: vi.fn() } }));
vi.mock('@main/utils/files');
vi.mock('@main/db/prisma', () => ({
  getPrismaClient: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: vi.fn() },
}));

describe('PublicKeyMapping Service', () => {
  let prismaMock: any;

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock = {
      publicKeyMapping: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock);
  });

  describe('getPublicKeys', () => {
    test('Should return all stored public keys', async () => {
      const storedKeys = [{ id: '1', public_key: 'publicKey1', nickname: 'key1' }];
      prismaMock.publicKeyMapping.findMany.mockResolvedValue(storedKeys);

      const result = await getPublicKeys();
      expect(prismaMock.publicKeyMapping.findMany).toHaveBeenCalled();
      expect(result).toEqual(storedKeys);
    });
  });

  describe('addPublicKey', () => {
    test('Should add a new public key', async () => {
      const newKey = { publicKey: 'publicKey1', nickname: 'key1' };
      const storedKey = { id: '1', public_key: 'publicKey1', nickname: 'key1' };

      prismaMock.publicKeyMapping.create.mockResolvedValue(storedKey);

      const result = await addPublicKey(newKey.publicKey, newKey.nickname);
      expect(prismaMock.publicKeyMapping.create).toHaveBeenCalledWith({
        data: { public_key: newKey.publicKey, nickname: newKey.nickname },
      });
      expect(result).toEqual(storedKey);
    });
  });

  describe('getPublicKey', () => {
    test('Should return a specific public key', async () => {
      const storedKey = { id: '1', public_key: 'publicKey1', nickname: 'key1' };
      prismaMock.publicKeyMapping.findUnique.mockResolvedValue(storedKey);

      const result = await getPublicKey('publicKey1');
      expect(prismaMock.publicKeyMapping.findUnique).toHaveBeenCalledWith({
        where: { public_key: 'publicKey1' },
      });
      expect(result).toEqual(storedKey);
    });

    test('Should return null if public key not found', async () => {
      prismaMock.publicKeyMapping.findUnique.mockResolvedValue(null);

      const result = await getPublicKey('nonExistingKey');
      expect(prismaMock.publicKeyMapping.findUnique).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('updatePublicKeyNickname', () => {
    test('Should update a public key nickname', async () => {
      const updatedKey = { id: '1', public_key: 'publicKey1', nickname: 'updatedKey' };

      prismaMock.publicKeyMapping.update.mockResolvedValue(updatedKey);

      const result = await updatePublicKeyNickname('1', 'updatedKey');
      expect(prismaMock.publicKeyMapping.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { nickname: 'updatedKey' },
      });
      expect(result).toEqual(updatedKey);
    });
  });

  describe('deletePublicKey', () => {
    test('Should delete a public key', async () => {
      prismaMock.publicKeyMapping.delete.mockResolvedValue(true as any);

      const result = await deletePublicKey('1');
      expect(prismaMock.publicKeyMapping.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toBeTruthy();
    });
  });
});

describe('PublicKey Search and Abortable', () => {
  describe('PublicKeySearcher', () => {
    let searcher: PublicKeySearcher;
    let abortable: PublicAbortable;

    beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
      vi.mocked(path.basename).mockImplementation((filePath: string) => {
        return filePath.replace('.pub', '');
      });

      abortable = new PublicAbortable(searchPublicKeysAbort);
      searcher = new PublicKeySearcher(abortable);
    });

    test('Should abort search and clean up search directories', async () => {
      const deleteSpy = vi.spyOn(searcher, 'deleteSearchDirs').mockResolvedValue(undefined);
      abortable.abort();

      const result = await searcher.search(['/some/path']);
      expect(deleteSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('Should mark state as aborted when abort is called', async () => {
      const abortable = new PublicAbortable(searchPublicKeysAbort);
      expect(abortable.state.aborted).toBe(false);
      abortable.abort();
      expect(abortable.state.aborted).toBe(true);
    });

    test('Should return empty when search is aborted in _searchFromDir', async () => {
      vi.mocked(fsp.readdir).mockResolvedValue(['key1.pub'] as unknown as Dirent[]);
      abortable.abort();
      const result = await searcher['_searchFromDir']('/path/to/dir');
      expect(result).toEqual([]);
    });

    test('Should log an error if directory deletion fails', async () => {
      const error = new Error('Failed to delete directory');
      vi.mocked(fsp.rm).mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'log');

      await searcher.deleteSearchDirs();

      expect(consoleSpy).toHaveBeenCalledWith('Delete search dirs error:', error);
    });

    test('Should properly process public key and ZIP files', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      vi.mocked(path.extname).mockReturnValue('.pub');
      vi.mocked(fsp.readFile).mockResolvedValue('PUBLIC_KEY_CONTENT');
      vi.mocked(path.basename).mockReturnValue('key');

      const result = await searcher['_searchFromPath']('/path/to/key.pub');

      expect(result).toEqual([{ publicKey: 'PUBLIC_KEY_CONTENT', nickname: 'key' }]);
    });

    test('Should log an error if searchFromPath fails', async () => {
      const error = new Error('Failed to read file');

      vi.mocked(fsp.stat).mockRejectedValue(error);
      vi.mocked(fsp.readFile).mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'log');

      const result = await searcher['_searchFromPath']('/path/to/key.pub');

      expect(consoleSpy).toHaveBeenCalledWith(error);
      expect(result).toEqual([]);
    });

    test('Should correctly search directories and log errors', async () => {
      vi.mocked(fsp.readdir).mockResolvedValue(['key1.pub', 'key2.pub'] as unknown as Dirent[]);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      vi.mocked(path.extname).mockReturnValue('.pub');
      vi.mocked(fsp.readFile).mockResolvedValue('PUBLIC_KEY_CONTENT');

      const result = await searcher['_searchFromDir']('/path/to/dir');

      expect(result.length).toBe(2);
      expect(result[0].publicKey).toBe('PUBLIC_KEY_CONTENT');
    });

    test('Should log error and continue processing if one file fails in _searchFromDir', async () => {
      const error = new Error('Failed to process file');
      vi.mocked(fsp.readdir).mockResolvedValue(['key1.pub', 'key2.pub'] as unknown as Dirent[]);
      vi.spyOn(searcher, '_searchFromPath' as any)
        .mockResolvedValueOnce([{ publicKey: 'VALID_KEY', nickname: 'key1' }])
        .mockRejectedValueOnce(error);

      const consoleSpy = vi.spyOn(console, 'log');

      const result = await searcher['_searchFromDir']('/path/to/dir');

      expect(consoleSpy).toHaveBeenCalledWith(error);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ publicKey: 'VALID_KEY', nickname: 'key1' });
    });

    test('Should extract and search public keys inside a zip file', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      vi.mocked(path.extname).mockReturnValue('.zip');
      vi.mocked(unzip).mockResolvedValue('');

      const result = await searcher['_searchFromPath']('/path/to/archive.zip');

      expect(result).toEqual([]);
    });

    test('Should search public keys in given zip path', async () => {
      const filePaths = ['/path/to/file.zip'];
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as Stats);

      vi.mocked(path.extname).mockReturnValue('.zip');
      vi.spyOn(searcher, '_searchFromZip' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromZip']).toHaveBeenCalledWith(filePaths[0]);
    });

    test('Should handle errors during ZIP extraction', async () => {
      const error = new Error('ZIP extraction failed');
      vi.mocked(unzip).mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error');

      const result = await searcher['_searchFromZip']('/path/to/archive.zip');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error extracting zip:',
        '/path/to/archive.zip',
        error,
      );
      expect(result).toEqual([]);
    });
  });
});
