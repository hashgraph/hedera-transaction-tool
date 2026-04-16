import { randomUUID } from 'crypto';

import { getPrismaClient } from '@main/db/prisma';
import { hash, dualCompareHash } from '@main/utils/crypto';

import { changeDecryptionPassword } from './keyPairs';

export const register = async (email: string, password: string) => {
  const prisma = getPrismaClient();

  return await prisma.user.create({
    data: {
      id: randomUUID(),
      email: email,
      password: await hash(password),
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const login = async (email: string, password: string, _autoRegister?: boolean) => {
  const prisma = getPrismaClient();

  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!user || email != user.email) {
    throw new Error('Incorrect email');
  }

  // if (autoRegister) {
  //   return await register(email, password);
  // } else if (email != firstUser.email) {
  //   throw new Error('Incorrect email');
  // }
  const { correct, isBcrypt } = await dualCompareHash(password, user.password);

  if (!correct) {
    throw new Error('Incorrect password');
  }

  /* Temporary to migrate users to new hashing algorithm */
  if (isBcrypt) {
    await updatePassword(user.id, password);
  }

  return user;
};

export const deleteUser = async (email: string) => {
  const prisma = getPrismaClient();

  await prisma.user.delete({
    where: {
      email,
    },
  });
};

export const getUsersCount = async () => {
  const prisma = getPrismaClient();
  return await prisma.user.count();
};

export const comparePasswords = async (userId: string, password: string) => {
  const prisma = getPrismaClient();

  const firstUser = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!firstUser) {
    throw new Error('User not found');
  }

  const { correct } = await dualCompareHash(password, firstUser.password);
  return correct;
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const isOldCorrect = await comparePasswords(userId, oldPassword);

  if (isOldCorrect) {
    await updatePassword(userId, newPassword);
  } else {
    throw new Error('Incorrect current password');
  }

  await changeDecryptionPassword(userId, oldPassword, newPassword);
};

export const updatePassword = async (id: string, password: string) => {
  await getPrismaClient().user.update({
    where: {
      id,
    },
    data: {
      password: await hash(password),
    },
  });
};
