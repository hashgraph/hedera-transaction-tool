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
export * from './encryptedKeys';
export * from './dataMigration';
export * from './sdk';
export * from './mnemonic';
export * from './publicKeyMapping';

import { session } from 'electron';

import initDatabase, { deleteDatabase } from '@main/db/init';
import { setPrismaClient, createPrismaClient } from '@main/db/prisma';
import { getSessionPartitionName } from '@main/utils/playwrightIsolation';

export const userStorageFolderName = 'User Storage';
export const getUserStorageFolderPath = (email: string) => `${userStorageFolderName}/${email}`;

let resettingDatabase = false;

export const resetDatabase = async () => {
  if (resettingDatabase) return;

  try {
    resettingDatabase = true;
    await deleteDatabase();
    setPrismaClient(createPrismaClient());
    await initDatabase();
  } finally {
    resettingDatabase = false;
  }
};

export const resetData = async () => {
  await session.fromPartition(getSessionPartitionName())?.clearStorageData();
  await resetDatabase();
};
