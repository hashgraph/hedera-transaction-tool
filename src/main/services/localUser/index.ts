export * from './auth';
export * from './keyPairs';
export * from './accounts';
export * from './files';
export * from './transactions';
export * from './transactionDrafts';

import initDatabase, { createPrismaClient, deleteDatabase, setPrismaClient } from '../../db';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async () => {
  await deleteDatabase();
  setPrismaClient(createPrismaClient());
  await initDatabase();
};
