import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateUserData,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Data Migration */
  createIPCChannel('dataMigration', [
    renameFunc(locateDataMigrationFiles, 'locateDataMigrationFiles'),
    renameFunc(decryptMigrationMnemonic, 'decryptMigrationMnemonic'),
    renameFunc(getDataMigrationKeysPath, 'getDataMigrationKeysPath'),
    renameFunc(migrateUserData, 'migrateUserData'),
  ]);
};
