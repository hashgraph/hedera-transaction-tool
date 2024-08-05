import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { getPrismaClient } from '@main/db/prisma';
import { changeDecryptionPassword } from './keyPairs';

export const register = async (email: string, password: string) => {
  const prisma = getPrismaClient();

  return await prisma.user.create({
    data: {
      id: randomUUID(),
      email: email,
      password: bcrypt.hashSync(password, 10),
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const login = async (email: string, password: string, _autoRegister?: boolean) => {
  const prisma = getPrismaClient();

  const firstUser = await prisma.user.findFirst();

  if (!firstUser) {
    throw new Error('Please register');
  }

  if (email != firstUser.email) {
    throw new Error('Incorrect email');
  }

  // if (autoRegister) {
  //   return await register(email, password);
  // } else if (email != firstUser.email) {
  //   throw new Error('Incorrect email');
  // }

  const correct = bcrypt.compareSync(password, firstUser.password);

  if (!correct) {
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

  return bcrypt.compareSync(password, firstUser.password);
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const prisma = getPrismaClient();

  const isOldCorrect = await comparePasswords(userId, oldPassword);

  if (isOldCorrect) {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: bcrypt.hashSync(newPassword, 10),
      },
    });
  } else {
    throw new Error('Incorrect current password');
  }

  await changeDecryptionPassword(userId, oldPassword, newPassword);
};
