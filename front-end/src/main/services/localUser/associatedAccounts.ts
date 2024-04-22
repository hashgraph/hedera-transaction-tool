import { getPrismaClient } from '@main/db';

export const getAssociatedAccounts = async (contactId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.associatedAccount.findMany({
      where: {
        contact_id: contactId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createAssociatedAccount = async (accountId: string, contactId: string) => {
  const prisma = getPrismaClient();

  const associatedAccounts = await getAssociatedAccounts(contactId);

  if (associatedAccounts.some(aa => aa.account_id === accountId)) {
    throw new Error('Account ID already exists!');
  }

  await prisma.associatedAccount.create({
    data: {
      account_id: accountId,
      contact_id: contactId,
    },
  });
};
