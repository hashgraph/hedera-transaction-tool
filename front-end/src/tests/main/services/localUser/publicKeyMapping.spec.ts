import { describe, expect, vi } from 'vitest';

import {
  getPublicKeys,
  addPublicKey,
  getPublicKey,
  updatePublicKeyNickname,
  deletePublicKey,
  searchPublicKeys,
  abortPublicKeySearch,
} from '@main/services/localUser/publicKeyMapping';
import { getPrismaClient } from '@main/db/prisma';
import { abortFileSearch, searchFiles } from '@main/utils/files';
import fsp from 'fs/promises';
import path from 'path';

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

  describe('searchEncryptedKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('calls searchFiles with correct arguments', async () => {
      vi.mocked(fsp.readFile)
        .mockResolvedValueOnce('publicKey1')
        .mockResolvedValueOnce('publicKey2');
      vi.mocked(path.basename)
        .mockReturnValueOnce('a')
        .mockReturnValueOnce('b');

      const mockResult = [
        {
          publicKey: 'publicKey1',
          nickname: 'a',
        },
        {
          publicKey: 'publicKey2',
          nickname: 'b',
        }
      ];

      vi.mocked(searchFiles).mockImplementation(async (filePaths, extensions, processFile) => {
        // Simulate calling processFile for each filePath
        const results = [];
        for (const filePath of filePaths) {
          const res = [await processFile(filePath)];
          results.push(...res);
        }
        return results;
      });

      const inputPaths = ['/a.pub', '/b.pub'];
      const result = await searchPublicKeys(inputPaths);

      expect(searchFiles).toHaveBeenCalledWith(
        inputPaths,
        ['.pub'],
        expect.any(Function),
      );
      expect(result).toEqual(mockResult);
    });

    test('returns empty array if searchFiles returns empty', async () => {
      vi.mocked(searchFiles).mockResolvedValue([]);

      // if no c.pub file found, processFile won't be called, so no results
      const result = await searchPublicKeys(['/c.pub']);
      expect(result).toEqual([]);
    });

    test('handles empty input', async () => {
      vi.mocked(searchFiles).mockResolvedValue([]);
      const result = await searchPublicKeys([]);
      expect(result).toEqual([]);
    });
  });

  describe('abortEncryptedKeySearch', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should call abortFileSearch', () => {
      abortPublicKeySearch();
      expect(abortFileSearch).toHaveBeenCalled();
    });
  });
});
