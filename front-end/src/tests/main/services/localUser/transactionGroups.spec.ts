import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  getGroups,
  getGroup,
  addGroup,
  updateGroup,
  deleteGroup,
  getGroupItems,
  addGroupItem,
  editGroupItem,
  deleteGroupItem,
  getGroupItem,
  getGroupsCount,
} from '@main/services/localUser/transactionGroups';
import { Prisma, TransactionGroup, GroupItem } from '@prisma/client';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Transaction Groups Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getGroups', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call prisma with correct findArgs', async () => {
      const findArgs: Prisma.TransactionGroupFindManyArgs = { where: { id: 'user1' } };

      await getGroups(findArgs);

      expect(prisma.transactionGroup.findMany).toHaveBeenCalledWith(findArgs);
    });

    test('Should throw error if prisma throws an error', async () => {
      const findArgs: Prisma.TransactionGroupFindManyArgs = { where: { id: 'user1' } };

      prisma.transactionGroup.findMany.mockRejectedValue(new Error('Failed to fetch groups'));

      await expect(getGroups(findArgs)).rejects.toThrow('Failed to fetch groups');
    });

    test('Should throw error if prisma throws without message', async () => {
      const findArgs: Prisma.TransactionGroupFindManyArgs = { where: { id: 'user1' } };

      prisma.transactionGroup.findMany.mockRejectedValue({});

      await expect(getGroups(findArgs)).rejects.toThrow('Failed to fetch transaction groups');
    });
  });

  describe('getGroup', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return groups based on findArgs', async () => {
      const id = 'group1';
      const group: TransactionGroup = {
        id,
        description: 'description',
        atomic: false,
        created_at: new Date(),
        groupValidStart: new Date(),
      };

      prisma.transactionGroup.findUnique.mockResolvedValue(group);

      const result = await getGroup(id);

      expect(prisma.transactionGroup.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(group);
    });

    test('Should throw error if group is not found', async () => {
      const id = 'group1';

      prisma.transactionGroup.findUnique.mockResolvedValue(null);

      expect(() => getGroup(id)).rejects.toThrow('Transaction group not found');
    });
  });

  describe('getGroupItem', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return a group item by group id and seq', async () => {
      const transaction_group_id = 'group1';
      const seq = '1';
      const groupItem = {
        transaction_group_id,
        seq,
        transaction_draft_id: 'draft1',
        transaction_id: 'tx1',
      };

      prisma.groupItem.findUnique.mockResolvedValue(groupItem);

      const result = await getGroupItem(transaction_group_id, seq);

      expect(prisma.groupItem.findUnique).toHaveBeenCalledWith({
        where: {
          transaction_group_id_seq: {
            transaction_group_id,
            seq,
          },
        },
      });
      expect(result).toEqual(groupItem);
    });

    test('Should throw error if group item is not found', async () => {
      const transaction_group_id = 'group1';
      const seq = '1';

      prisma.groupItem.findUnique.mockResolvedValue(null);

      await expect(getGroupItem(transaction_group_id, seq)).rejects.toThrow(
        'Transaction group not found',
      );
    });
  });

  describe('addGroup', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a new group', async () => {
      const group: Prisma.TransactionGroupUncheckedCreateInput = {
        description: 'description',
        atomic: false,
      };

      await addGroup(group);

      expect(prisma.transactionGroup.create).toHaveBeenCalledWith({ data: group });
    });

    test('Should rethrow error if prisma throws an error', async () => {
      const group: Prisma.TransactionGroupUncheckedCreateInput = {
        description: 'description',
        atomic: false,
      };

      prisma.transactionGroup.create.mockRejectedValue(new Error('Failed to create group'));

      await expect(addGroup(group)).rejects.toThrow('Failed to create group');
    });
  });

  describe('updateGroup', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update a group by id', async () => {
      const id = 'group1';
      const updateData = {
        description: 'new description',
        atomic: true,
        groupValidDate: new Date(),
      };

      await updateGroup(id, updateData);

      expect(prisma.transactionGroup.update).toHaveBeenCalledWith({
        where: { id },
        data: updateData,
      });
    });
  });

  describe('deleteGroup', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete a group by id', async () => {
      const id = 'group1';

      await deleteGroup(id);

      expect(prisma.groupItem.deleteMany).toHaveBeenCalledWith({
        where: { transaction_group_id: id },
      });
      expect(prisma.transactionDraft.deleteMany).toHaveBeenCalledWith({
        where: { GroupItem: { some: { transaction_group_id: id } } },
      });
      expect(prisma.transactionGroup.delete).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('getGroupItems', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return group items by group id', async () => {
      const id = 'group1';
      const groupItems: GroupItem[] = [
        { transaction_id: '1', transaction_group_id: id, seq: '1', transaction_draft_id: 'draft1' },
      ];

      prisma.groupItem.findMany.mockResolvedValue(groupItems);

      const result = await getGroupItems(id);

      expect(prisma.groupItem.findMany).toHaveBeenCalledWith({
        where: { transaction_group_id: id },
        orderBy: { seq: 'asc' },
      });
      expect(result).toEqual(groupItems);
    });
  });

  describe('getGroupsCount', () => {
    test('Should return the count of groups based on findArgs', async () => {
      const user_id = 'user1';
      const count = 5;

      prisma.transactionGroup.count.mockResolvedValue(count);

      const result = await getGroupsCount(user_id);

      expect(prisma.transactionGroup.count).toHaveBeenCalledWith({
        where: {
          GroupItem: {
            every: {
              transaction_draft: {
                user_id,
              },
            },
          },
        },
      });
      expect(result).toEqual(count);
    });

    test("Should throw error if prisma throws an error or doesn't return a count", async () => {
      const user_id = 'user1';

      prisma.transactionGroup.count.mockRejectedValueOnce(new Error('Failed to get drafts count'));

      await expect(getGroupsCount(user_id)).rejects.toThrow('Failed to get drafts count');
    });

    test('Should throw error if prisma throws without message', async () => {
      const user_id = 'user1';

      prisma.transactionGroup.count.mockRejectedValueOnce({});

      await expect(getGroupsCount(user_id)).rejects.toThrow('Failed to get drafts count');
    });
  });

  describe('addGroupItem', () => {
    test('Should add a new group item', async () => {
      const groupItem: Prisma.GroupItemUncheckedCreateInput = {
        transaction_group_id: 'group1',
        seq: '1',
        transaction_draft_id: 'draft1',
      };

      await addGroupItem(groupItem);

      expect(prisma.groupItem.create).toHaveBeenCalledWith({ data: groupItem });
    });
  });

  describe('editGroupItem', () => {
    test('Should update a group item', async () => {
      const groupItem: GroupItem = {
        transaction_group_id: 'group1',
        seq: '1',
        transaction_draft_id: 'draft1',
        transaction_id: 'tx1',
      };

      await editGroupItem(groupItem);

      expect(prisma.groupItem.update).toHaveBeenCalledWith({
        where: {
          transaction_group_id_seq: {
            transaction_group_id: groupItem.transaction_group_id,
            seq: groupItem.seq,
          },
        },
        data: {
          transaction_draft_id: groupItem.transaction_draft_id,
          transaction_id: groupItem.transaction_id,
        },
      });
    });
  });

  describe('deleteGroupItem', () => {
    test('Should delete a group item by group id and seq', async () => {
      const transaction_group_id = 'group1';
      const seq = '1';

      await deleteGroupItem(transaction_group_id, seq);

      expect(prisma.groupItem.delete).toHaveBeenCalledWith({
        where: {
          transaction_group_id_seq: {
            transaction_group_id,
            seq,
          },
        },
      });
    });
  });
});
