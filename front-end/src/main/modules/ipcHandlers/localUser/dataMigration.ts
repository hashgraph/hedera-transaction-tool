import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateUserData,
} from '@main/services/localUser';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Data Migration */
  createIPCChannel('dataMigration', [
    locateDataMigrationFiles,
    decryptMigrationMnemonic,
    getDataMigrationKeysPath,
    migrateUserData,
  ]);
};
