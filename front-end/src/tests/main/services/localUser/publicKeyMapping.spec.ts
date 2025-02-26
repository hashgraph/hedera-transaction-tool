import { expect, vi } from 'vitest';
import * as fsp from 'fs/promises';
import * as path from 'path';
import EventEmitter from 'events';
import { app } from 'electron';

import {
  getFileStreamEventEmitterPublic,
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
  describe('getFileStreamEventEmitterPublic', () => {
    test('Should return a singleton EventEmitter instance', () => {
      const emitter1 = getFileStreamEventEmitterPublic();
      const emitter2 = getFileStreamEventEmitterPublic();

      expect(emitter1).toBe(emitter2);
      expect(emitter1).toBeInstanceOf(EventEmitter);
    });
  });

  describe('PublicAbortable', () => {
    test('Should set aborted state to true on abort event', () => {
      const abortable = new PublicAbortable(searchPublicKeysAbort);

      expect(abortable.state.aborted).toBe(false);

      getFileStreamEventEmitterPublic().emit(searchPublicKeysAbort);

      expect(abortable.state.aborted).toBe(true);
    });
  });

  describe('PublicKeySearcher', () => {
    let searcher: PublicKeySearcher;
    let abortable: PublicAbortable;

    beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

      abortable = new PublicAbortable(searchPublicKeysAbort);
      searcher = new PublicKeySearcher(abortable);
    });

    test('Should create search directory', async () => {
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);
      await searcher.search([]);

      expect(fsp.mkdir).toHaveBeenCalledWith(expect.stringContaining(tempDir), { recursive: true });
    });

    test('Should search public key files in given paths', async () => {
      const filePaths = ['/path/to/dir', '/path/to/file1.pub', '/path/to/file2.zip'];
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[0]);
      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[1]);
      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[2]);
    });

    test('Should search public key files in given directory path', async () => {
      const filePaths = ['/path/to/dir'];
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      vi.spyOn(searcher, '_searchFromDir' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromDir']).toHaveBeenCalledWith(filePaths[0]);
    });

    test('Should handle ZIP file search', async () => {
      const zipPath = '/path/to/file.zip';
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_searchFromDir' as any).mockImplementation(vi.fn());

      await searcher['_searchFromZip'](zipPath);

      expect(unzip).toHaveBeenCalledWith(
        zipPath,
        expect.stringContaining(tempDir),
        ['.pub'],
        abortable.state,
      );
      expect(searcher['_searchFromDir']).toHaveBeenCalled();
    });

    test('Should delete search directories successfully', async () => {
      const searchDir = '/path/to/searchDir';
      const unzipDirs = ['/path/to/unzipDir1', '/path/to/unzipDir2'];
      searcher.searchDir = searchDir;
      searcher.unzipDirs = unzipDirs;

      vi.mocked(fsp.rm).mockResolvedValue(undefined);

      await searcher.deleteSearchDirs();

      expect(fsp.rm).toHaveBeenCalledWith(searchDir, { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[0], { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[1], { recursive: true });
    });
  });
});
