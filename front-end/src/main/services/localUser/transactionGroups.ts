import { Prisma } from '@prisma/client';
import { getPrismaClient } from '@main/db';

// export const getDrafts = async (findArgs: Prisma.TransactionDraftFindManyArgs) => {
//   const prisma = getPrismaClient();

//   const drafts = await prisma.transactionDraft.findMany(findArgs);

//   return drafts;
// };

// export const getDraft = async (id: string) => {
//   const prisma = getPrismaClient();

//   const draft = await prisma.transactionDraft.findFirst({
//     where: {
//       id,
//     },
//   });

//   if (!draft) {
//     throw new Error('Transaction draft not found');
//   }

//   return draft;
// };

export const addGroup = async (group: Prisma.TransactionGroupUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  return await prisma.transactionGroup.create({
    data: group,
  });
};
