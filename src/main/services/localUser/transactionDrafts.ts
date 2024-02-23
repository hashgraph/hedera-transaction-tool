import { TransactionDraft } from '@prisma/client';
import { getPrismaClient } from '@main/db';

export const getDrafts = async (userId: string) => {
  const prisma = getPrismaClient();

  const drafts = await prisma.transactionDraft.findMany({
    where: {
      user_id: userId,
    },
  });

  return drafts;
};

export const getDraft = async (id: string) => {
  const prisma = getPrismaClient();

  const draft = await prisma.transactionDraft.findFirst({
    where: {
      id: id,
    },
  });

  return draft;
};

export const addDraft = async (draft: TransactionDraft) => {
  if (await draftExists(draft.transactionBytes)) {
    throw new Error('Transaction draft already exists');
  }

  const prisma = getPrismaClient();

  await prisma.transactionDraft.create({
    data: {
      ...draft,
      id: undefined,
    },
  });
};

export const deleteDraft = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.transactionDraft.delete({
    where: {
      id: id,
    },
  });
};

export const draftExists = async (transactionBytes: string) => {
  const prisma = getPrismaClient();

  const count = await prisma.transactionDraft.count({
    where: {
      transactionBytes: transactionBytes,
    },
  });

  return count > 0;
};
