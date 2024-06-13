import { Prisma } from '@prisma/client';
import { getPrismaClient } from '@main/db/prisma';

export const getDrafts = async (findArgs: Prisma.TransactionDraftFindManyArgs) => {
  const prisma = getPrismaClient();

  const drafts = await prisma.transactionDraft.findMany(findArgs);

  return drafts;
};

export const getDraft = async (id: string) => {
  const prisma = getPrismaClient();

  const draft = await prisma.transactionDraft.findFirst({
    where: {
      id,
    },
  });

  if (!draft) {
    throw new Error('Transaction draft not found');
  }

  return draft;
};

export const addDraft = async (draft: Prisma.TransactionDraftUncheckedCreateInput) => {
  if (await draftExists(draft.transactionBytes)) {
    throw new Error('Transaction draft already exists');
  }

  const prisma = getPrismaClient();

  return await prisma.transactionDraft.create({
    data: draft,
  });
};

export const updateDraft = async (
  id: string,
  { type, transactionBytes, isTemplate, details }: Prisma.TransactionDraftUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.transactionDraft.update({
    where: {
      id,
    },
    data: {
      type,
      transactionBytes,
      isTemplate,
      details,
    },
  });
};

export const deleteDraft = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.transactionDraft.delete({
    where: {
      id,
    },
  });
};

export const draftExists = async (transactionBytes: string) => {
  const prisma = getPrismaClient();

  const count = await prisma.transactionDraft.count({
    where: {
      transactionBytes,
    },
  });

  return count > 0;
};

export const getDraftsCount = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    const count = await prisma.transactionDraft.count({
      where: {
        user_id: userId,
      },
    });

    return count;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get drafts count');
  }
};
