import { Prisma } from '@prisma/client';

import { Network } from '@main/shared/enums';

import { getPrismaClient } from '@main/db/prisma';

export const getAccounts = (findArgs: Prisma.HederaAccountFindManyArgs) => {
  const prisma = getPrismaClient();

  try {
    return prisma.hederaAccount.findMany(findArgs);
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addAccount = async (
  userId: string,
  accountId: string,
  network: Network,
  nickname: string = '',
) => {
  const prisma = getPrismaClient();

  const findArgs = {
    where: {
      user_id: userId,
    },
  };

  const accounts = await getAccounts(findArgs);

  if (
    accounts.some(acc => acc.account_id === accountId || (nickname && acc.nickname === nickname))
  ) {
    throw new Error('Account ID or Nickname already exists!');
  }

  await prisma.hederaAccount.create({
    data: {
      user_id: userId,
      account_id: accountId,
      network: network,
      nickname: nickname,
    },
  });

  return await getAccounts(findArgs);
};

export const removeAccounts = async (userId: string, accountIds: string[]) => {
  const prisma = getPrismaClient();

  await prisma.hederaAccount.deleteMany({
    where: {
      user_id: userId,
      account_id: {
        in: accountIds,
      },
    },
  });
};

export const changeAccountNickname = async (
  userId: string,
  accountId: string,
  nickname: string,
) => {
  const prisma = getPrismaClient();

  await prisma.hederaAccount.updateMany({
    where: {
      user_id: userId,
      account_id: accountId,
    },
    data: {
      nickname: nickname,
    },
  });

  return await getAccounts({
    where: {
      user_id: userId,
    },
  });
};
