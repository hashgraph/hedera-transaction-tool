export * from './auth';
export * from './keyPairs';
export * from './accounts';
export * from './files';
export * from './transactions';
export * from './transactionDrafts';
export * from './transactionGroups';
export * from './complexKeys';
export * from './organizations';
export * from './organizationCredentials';
export * from './contacts';
export * from './publicKeyLinked';
export * from './encryptedKeys';
export * from './dataMigration';
export * from './sdk';

import { session } from 'electron';

import initDatabase, { deleteDatabase } from '@main/db/init';
import { setPrismaClient, createPrismaClient } from '@main/db/prisma';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `User Storage/${email}`;

export const resetData = async () => {
  await session.fromPartition('persist:main')?.clearStorageData();
  await deleteDatabase();
  setPrismaClient(createPrismaClient());
  await initDatabase();
};
