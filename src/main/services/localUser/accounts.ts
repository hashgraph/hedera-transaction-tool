import { getPrismaClient } from '../../db';

const prisma = getPrismaClient();

export const getAccounts = (userId: string) => {
  try {
    return prisma.hederaAccount.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addAccount = async (userId: string, accountId: string, nickname: string = '') => {
  const accounts = await getAccounts(userId);

  if (
    accounts.some(acc => acc.account_id === accountId || (nickname && acc.nickname === nickname))
  ) {
    throw new Error('Account ID or Nickname already exists!');
  }

  await prisma.hederaAccount.create({
    data: {
      user_id: userId,
      account_id: accountId,
      nickname: nickname,
    },
  });

  return await getAccounts(userId);
};

export const removeAccount = async (userId: string, accountId: string, nickname?: string) => {
  const accounts = await getAccounts(userId);

  if (
    !accounts.some(acc => acc.account_id === accountId || (nickname && acc.nickname === nickname))
  ) {
    throw new Error(`Account ID ${nickname && `or ${nickname}`} not found!`);
  }

  await prisma.hederaAccount.deleteMany({
    where: {
      user_id: userId,
      account_id: accountId,
    },
  });

  return await getAccounts(userId);
};
