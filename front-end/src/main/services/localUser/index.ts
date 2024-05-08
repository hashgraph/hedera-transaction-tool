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
export * from './publicKeyLinked';

import { session } from 'electron';
import initDatabase, { createPrismaClient, deleteDatabase, setPrismaClient } from '../../db';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async () => {
  await session.fromPartition('persist:main')?.clearStorageData();
  await deleteDatabase();
  setPrismaClient(createPrismaClient());
  await initDatabase();
};
