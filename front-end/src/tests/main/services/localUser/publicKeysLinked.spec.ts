import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  createLinkedPublicKey,
  deleteLinkedPublicKey,
  getLinkedPublicKeys,
} from '@main/services/localUser';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Services Local User Public Keys Linked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getLinkedPublicKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return linked public keys for a user', async () => {
      const user_id = 'user1';
      const linkedPublicKeys = [{ id: 'key1', user_id, publicKey: 'publicKey1', nickname: '' }];

      prisma.publicKeyLinked.findMany.mockResolvedValue(linkedPublicKeys);

      const result = await getLinkedPublicKeys(user_id);

      expect(prisma.publicKeyLinked.findMany).toHaveBeenCalledWith({ where: { user_id } });
      expect(result).toEqual(linkedPublicKeys);
    });

    test('Should return empty array on error', async () => {
      const user_id = 'user1';
      prisma.publicKeyLinked.findMany.mockRejectedValue('Public keys linked database error');

      const result = await getLinkedPublicKeys(user_id);

      expect(prisma.publicKeyLinked.findMany).toHaveBeenCalledWith({ where: { user_id } });
      expect(result).toEqual([]);
    });
  });

  describe('createLinkedPublicKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('createLinkedPublicKey should create a linked public key', async () => {
      const user_id = 'user1';
      const publicKey = { publicKey: 'publicKey1', user_id, nickname: '' };

      await createLinkedPublicKey(user_id, publicKey);

      expect(prisma.publicKeyLinked.create).toHaveBeenCalledWith({
        data: { ...publicKey, user_id },
      });
    });
  });

  describe('deleteLinkedPublicKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete a linked public key', async () => {
      const id = 'key1';

      await deleteLinkedPublicKey(id);

      expect(prisma.publicKeyLinked.delete).toHaveBeenCalledWith({ where: { id } });
    });
  });
});
