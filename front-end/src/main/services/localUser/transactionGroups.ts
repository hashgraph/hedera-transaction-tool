import { GroupItem, Prisma } from '@prisma/client';
import { getPrismaClient } from '@main/db/prisma';

export const getGroups = async (findArgs: Prisma.TransactionGroupFindManyArgs) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.transactionGroup.findMany(findArgs);
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch transaction groups');
  }
};

export const getGroup = async (id: string) => {
  const prisma = getPrismaClient();

  const group = await prisma.transactionGroup.findUnique({
    where: {
      id,
    },
  });

  if (!group) {
    throw new Error('Transaction group not found');
  }

  return group;
};

export async function getGroupItem(id: string, seq: string) {
  const prisma = getPrismaClient();

  const group = await prisma.groupItem.findUnique({
    where: {
      transaction_group_id_seq: {
        transaction_group_id: id,
        seq: seq,
      },
    },
  });

  if (!group) {
    throw new Error('Transaction group not found');
  }

  return group;
}

export const addGroup = async (group: Prisma.TransactionGroupUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  return await prisma.transactionGroup.create({
    data: group,
  });
};

export async function updateGroup(id: string, data: Prisma.TransactionGroupUncheckedUpdateInput) {
  const prisma = getPrismaClient();

  delete data.GroupItem;
  delete data.created_at;
  delete data.id;

  return await prisma.transactionGroup.update({
    where: {
      id,
    },
    data,
  });
}

export const addGroupItem = async (groupItem: Prisma.GroupItemUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  return await prisma.groupItem.create({
    data: groupItem,
  });
};

export async function getGroupItems(id: string) {
  const prisma = getPrismaClient();

  const groups = await prisma.groupItem.findMany({
    where: {
      transaction_group_id: id,
    },
    orderBy: {
      seq: 'asc',
    },
  });

  return groups;
}

export const getGroupsCount = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    const count = await prisma.transactionGroup.count({
      where: {
        GroupItem: {
          every: {
            transaction_draft: {
              user_id: userId,
            },
          },
        },
      },
    });

    return count;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to get drafts count');
  }
};

export async function deleteGroup(id: string) {
  const prisma = getPrismaClient();

  await prisma.transactionDraft.deleteMany({
    where: {
      GroupItem: {
        some: {
          transaction_group_id: id,
        },
      },
    },
  });

  await prisma.groupItem.deleteMany({
    where: {
      transaction_group_id: id,
    },
  });

  await prisma.transactionGroup.delete({
    where: {
      id,
    },
  });
}

export async function editGroupItem(groupItem: GroupItem) {
  const prisma = getPrismaClient();

  await prisma.groupItem.update({
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
}

export async function deleteGroupItem(transaction_group_id: string, seq: string) {
  const prisma = getPrismaClient();

  await prisma.groupItem.delete({
    where: {
      transaction_group_id_seq: {
        transaction_group_id,
        seq,
      },
    },
  });
}
