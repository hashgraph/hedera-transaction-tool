import type { Network } from '@shared/interfaces';

import { Prisma } from '@prisma/client';

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

export const getAccountById = async (userId: string, accountId: string) => {
  const prisma = getPrismaClient();

  try {
    const account = await prisma.hederaAccount.findFirst({
      where: {
        user_id: userId,
        account_id: accountId,
      },
    });

    return account || null;
  } catch (error) {
    console.error('Error fetching account:', error);
    return null;
  }
};

export const addAccount = async (
  userId: string,
  accountId: string,
  network: Network,
  nickname: string = '',
) => {
  const prisma = getPrismaClient();

  const alreadyAddedCount = await prisma.hederaAccount.count({
    where: {
      user_id: userId,
      OR: [
        { account_id: accountId, network },
        nickname.trim().length > 0 ? { nickname: nickname, network } : {},
      ],
    },
  });

  if (alreadyAddedCount > 0) {
    throw new Error('Account ID or Nickname already exists!');
  }

  await prisma.hederaAccount.create({
    data: {
      user_id: userId,
      account_id: accountId,
      network: network,
      nickname: nickname.trim().length > 0 ? nickname : null,
    },
  });

  return await getAccounts({
    where: {
      user_id: userId,
    },
  });
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
  nickname?: string,
) => {
  const prisma = getPrismaClient();

  await prisma.hederaAccount.updateMany({
    where: {
      user_id: userId,
      account_id: accountId,
    },
    data: {
      nickname: nickname && nickname?.trim().length > 0 ? nickname : null,
    },
  });

  return await getAccounts({
    where: {
      user_id: userId,
    },
  });
};
