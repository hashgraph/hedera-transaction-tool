import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  getDraftsCount,
  updateDraft,
} from '@main/services/localUser/transactionDrafts';
import { Prisma, TransactionDraft } from '@prisma/client';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Services Local User Public Keys Linked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getDrafts', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return drafts based on findArgs', async () => {
      const findArgs = { where: { user_id: 'user1' } };

      await getDrafts(findArgs);

      expect(prisma.transactionDraft.findMany).toHaveBeenCalledWith(findArgs);
    });
  });

  describe('getDragt', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return a draft by id', async () => {
      const id = 'draft1';
      const draft: TransactionDraft = {
        id,
        user_id: 'user1',
        transactionBytes: 'bytes1',
        created_at: new Date(),
        updated_at: new Date(),
        isTemplate: false,
        description: 'description',
        details: '',
        type: 'type1',
      };

      prisma.transactionDraft.findFirst.mockResolvedValue(draft);

      const result = await getDraft(id);

      expect(prisma.transactionDraft.findFirst).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(draft);
    });

    test('Should throw error if draft is not found', async () => {
      const id = 'draft1';

      prisma.transactionDraft.findFirst.mockResolvedValue(null);

      expect(() => getDraft(id)).rejects.toThrow('Transaction draft not found');
    });
  });

  describe('addDraft', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a new draft', async () => {
      const draft: Prisma.TransactionDraftUncheckedCreateInput = {
        user_id: 'user1',
        transactionBytes: 'bytes1',
        isTemplate: false,
        description: 'description',
        details: '',
        type: 'type1',
      };

      await addDraft(draft);

      expect(prisma.transactionDraft.create).toHaveBeenCalledWith({ data: draft });
    });

    test('Should throw error if draft exists', async () => {
      const draft: Prisma.TransactionDraftUncheckedCreateInput = {
        user_id: 'user1',
        transactionBytes: 'bytes1',
        isTemplate: false,
        description: 'description',
        details: '',
        type: 'type1',
      };

      prisma.transactionDraft.count.mockResolvedValue(1);

      expect(() => addDraft(draft)).rejects.toThrow('Transaction draft already exists');
    });
  });

  describe('updateDraft', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update a draft by id', async () => {
      const id = 'draft1';
      const updateData = {
        type: 'newType',
        transactionBytes: 'bytes2',
        isTemplate: true,
        details: 'details',
      };

      await updateDraft(id, updateData);

      expect(prisma.transactionDraft.update).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('deleteDraft', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete a draft by id', async () => {
      const id = 'draft1';

      await deleteDraft(id);

      expect(prisma.transactionDraft.delete).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('draftExists', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true if draft exists', async () => {
      const transactionBytes = 'bytes1';

      prisma.transactionDraft.count.mockResolvedValue(1);

      const result = await draftExists(transactionBytes);

      expect(prisma.transactionDraft.count).toHaveBeenCalledWith({ where: { transactionBytes } });
      expect(result).toBe(true);
    });
  });

  describe('getDraftsCount', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return the count of drafts for a user', async () => {
      const userId = 'user1';

      prisma.transactionDraft.count.mockResolvedValue(2);

      const result = await getDraftsCount(userId);

      expect(prisma.transactionDraft.count).toHaveBeenCalledWith({ where: { user_id: userId } });
      expect(result).toBe(2);
    });

    test('Should throw error if failed to get count', async () => {
      const userId = 'user1';

      prisma.transactionDraft.count.mockRejectedValueOnce('Transaction draft Database error');
      prisma.transactionDraft.count.mockRejectedValueOnce(
        new Error('Transaction draft Database error'),
      );

      expect(() => getDraftsCount(userId)).rejects.toThrow('Failed to get drafts count');
      expect(() => getDraftsCount(userId)).rejects.toThrow(
        new Error('Transaction draft Database error'),
      );
    });
  });
});
