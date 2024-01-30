import { generateUUID, hash } from '../../utils/crypto';

import { getPrismaClient } from '../../db';

const prisma = getPrismaClient();

export const register = async (email: string, password: string) => {
  return await prisma.user.create({
    data: {
      id: generateUUID(),
      email: email,
      password: hash(password).toString('hex'),
    },
  });
};

export const login = async (email: string, password: string, autoRegister?: boolean) => {
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
  await prisma.user.delete({
    where: {
      email,
    },
  });
};

export const getUsersCount = () => prisma.user.count();

export const comparePasswords = async (userId: string, password: string) => {
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
