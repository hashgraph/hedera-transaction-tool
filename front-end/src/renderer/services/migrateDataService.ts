import type { MigrateUserDataResult } from '@shared/interfaces/migration';

import { commonIPCHandler } from '@renderer/utils';

/* Locates the migration file */
export const locateDataMigrationFiles = async (): Promise<boolean> =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.dataMigration.locateDataMigrationFiles();
  }, 'Locating migration files failed');

/* Find and decrypt the mnemonic */
export const decryptMigrationMnemonic = async (password: string): Promise<string[] | null> =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.dataMigration.decryptMigrationMnemonic(password);
  }, 'Decrypting mnemonic failed');

export const getDataMigrationKeysPath = async (): Promise<string> =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.dataMigration.getDataMigrationKeysPath();
  }, 'No path for data migration keys found');

/* Begins data migration */
export const migrateUserData = async (userId: string): Promise<MigrateUserDataResult> =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.dataMigration.migrateUserData(userId);
  }, 'Account data migration failed');
