export * from './auth';
export * from './keyPairs';
export * from './accounts';
export * from './transactions';

import { getPrismaClient } from '../../db';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async () => {
  const prisma = getPrismaClient();

  await prisma.transaction.deleteMany();
  await prisma.keyPair.deleteMany();
  await prisma.user.deleteMany();
};
