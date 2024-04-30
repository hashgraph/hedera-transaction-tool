export * from './auth';
export * from './keyPairs';
export * from './accounts';
export * from './files';
export * from './transactions';
export * from './transactionDrafts';
export * from './complexKeys';
export * from './organizations';
export * from './organizationCredentials';
export * from './contacts';
export * from './associatedAccounts';
export * from './publicKeyLinked';

import initDatabase, { createPrismaClient, deleteDatabase, setPrismaClient } from '../../db';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async () => {
  await deleteDatabase();
  setPrismaClient(createPrismaClient());
  await initDatabase();
};
