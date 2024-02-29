import { hash } from '@main/utils/crypto';
import { randomUUID } from 'crypto';

import { getPrismaClient } from '@main/db';
import { changeDecryptionPassword } from './keyPairs';

export const register = async (email: string, password: string) => {
  const prisma = getPrismaClient();

  return await prisma.user.create({
    data: {
      id: randomUUID(),
      email: email,
      password: hash(password).toString('hex'),
    },
  });
};

export const login = async (email: string, password: string, autoRegister?: boolean) => {
  const prisma = getPrismaClient();

  const firstUser = await prisma.user.findFirst();

  if (!firstUser) {
    throw new Error('Please register');
  }

  if (autoRegister) {
    return await register(email, password);
  } else if (email != firstUser.email) {
    throw new Error('Incorrect email');
  }

  if (hash(password).toString('hex') !== firstUser.password) {
    throw new Error('Incorrect password');
  }

  return firstUser;
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

  if (hash(password).toString('hex') === firstUser.password) {
    return true;
  } else {
    return false;
  }
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const prisma = getPrismaClient();

  const isOldCorrect = await comparePasswords(userId, oldPassword);

  if (isOldCorrect) {
    prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hash(newPassword).toString('hex'),
      },
    });
  } else {
    throw new Error('Incorrect current password');
  }

  await changeDecryptionPassword(userId, oldPassword, newPassword);
};
