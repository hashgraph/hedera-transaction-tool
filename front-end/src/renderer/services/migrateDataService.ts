import { commonIPCHandler } from '@renderer/utils';
import { Network } from '@main/shared/enums';

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
export const migrateAccountsData = async (userId: string, network: Network): Promise<number> =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.dataMigration.migrateAccountsData(userId, network);
  }, 'Account data migration failed');
