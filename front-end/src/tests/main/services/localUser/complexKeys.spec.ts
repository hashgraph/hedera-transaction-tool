import { expect, vi } from 'vitest';

import { KeyList, PrivateKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { ComplexKey } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  addComplexKey,
  complexKeyExists,
  deleteComplexKey,
  getComplexKey,
  getComplexKeys,
  updateComplexKey,
} from '@main/services/localUser/complexKeys';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Services Local User Complex Keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const publicKey1 = PrivateKey.generateED25519().publicKey;
  const publicKey2 = PrivateKey.generateED25519().publicKey;
  const keyList = new KeyList([publicKey1, publicKey2]);
  const keyListBytes = proto.Key.encode(keyList._toProtobufKey()).finish();
  const keyListBytesString = keyListBytes.join(',');

  const now = new Date();
  const complexKey = (): ComplexKey => ({
    id: '321',
    user_id: '123',
    protobufEncoded: Buffer.from(keyListBytes).toString('hex'),
    nickname: 'Key 1',
    created_at: now,
    updated_at: now,
  });

  describe('getComplexKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return the complex keys for a user with formatted key bytes', async () => {
      const formattedComplexKey = { ...complexKey(), protobufEncoded: keyListBytesString };

      prisma.complexKey.findMany.mockResolvedValueOnce([complexKey()]);

      const result = await getComplexKeys(complexKey().user_id);

      expect(result).toStrictEqual([formattedComplexKey]);
    });

    test('Should return an empty array if an error occurs', async () => {
      prisma.complexKey.findMany.mockRejectedValue(new Error('Test error'));

      const result = await getComplexKeys('123');

      expect(result).toEqual([]);
    });
  });

  describe('getComplexKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return the complex key for a user with formatted key bytes', async () => {
      const formattedComplexKey = { ...complexKey(), protobufEncoded: keyListBytesString };
      prisma.complexKey.findFirst.mockResolvedValue(complexKey());

      const result = await getComplexKey(complexKey().user_id, keyListBytes);

      expect(result).toStrictEqual(formattedComplexKey);
    });

    test('Should return null if no key is found', async () => {
      const userId = '123';

      prisma.complexKey.findFirst.mockResolvedValue(null);

      const result = await getComplexKey(userId, keyListBytes);

      expect(result).toBeNull();
    });
  });

  describe('complexKeyExists', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true if the complex key exists', async () => {
      prisma.complexKey.count.mockResolvedValue(1);

      const result = await complexKeyExists(complexKey().user_id, keyListBytes);

      expect(result).toBe(true);
    });

    test('Should return false if the complex key does not exist', async () => {
      prisma.complexKey.count.mockResolvedValue(0);

      const result = await complexKeyExists(complexKey().user_id, keyListBytes);

      expect(result).toBe(false);
    });
  });

  describe('addComplexKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a new complex key and return it', async () => {
      const formattedComplexKey = { ...complexKey(), protobufEncoded: keyListBytesString };

      prisma.complexKey.count.mockResolvedValue(0);

      prisma.complexKey.create.mockResolvedValue(complexKey());

      const result = await addComplexKey(complexKey().user_id, keyListBytes, complexKey().nickname);

      expect(result).toStrictEqual(formattedComplexKey);
    });

    test('Should throw an error if the complex key already exists', async () => {
      const userId = '123';
      const keyListBytes = Uint8Array.from([1, 2, 3]);
      const nickname = 'Key 1';

      prisma.complexKey.count.mockResolvedValue(1);

      await expect(addComplexKey(userId, keyListBytes, nickname)).rejects.toThrow(
        'Complex key already exists!',
      );
    });
  });

  describe('deleteComplexKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the complex key', async () => {
      const id = '123';

      await deleteComplexKey(id);

      expect(prisma.complexKey.deleteMany).toHaveBeenCalledWith({
        where: {
          id,
        },
      });
    });
  });

  describe('updateComplexKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update the complex key and return it', async () => {
      const newKeyListBytes = Uint8Array.from([1, 2, 3]);

      const formattedComplexKey = { ...complexKey(), protobufEncoded: newKeyListBytes.toString() };

      prisma.complexKey.findFirst.mockResolvedValue(formattedComplexKey);

      const result = await updateComplexKey(complexKey().id, newKeyListBytes);

      expect(result).toStrictEqual(formattedComplexKey);
    });

    test('Should throw an error if the complex key is not found', async () => {
      const id = '123';
      const newKeyListBytes = Uint8Array.from([1, 2, 3]);

      prisma.complexKey.findFirst.mockResolvedValue(null);

      await expect(updateComplexKey(id, newKeyListBytes)).rejects.toThrow('Complex key not found!');
    });
  });
});
