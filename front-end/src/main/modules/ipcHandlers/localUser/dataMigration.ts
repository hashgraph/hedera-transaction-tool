import { ipcMain } from 'electron';

import { MigrateUserDataResult } from '@main/shared/interfaces/migration';

import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateUserData,
} from '@main/services/localUser';

const createChannelName = (...props) => ['dataMigration', ...props].join(':');

export default () => {
  // Locates the data migration files
  ipcMain.handle(createChannelName('locateDataMigrationFiles'), async (): Promise<boolean> => {
    return locateDataMigrationFiles();
  });

  // Decrypts the encrypted key in the given file path
  ipcMain.handle(
    createChannelName('decryptMigrationMnemonic'),
    async (_e, password: string): Promise<string[] | null> => {
      return decryptMigrationMnemonic(password);
    },
  );

  // Gets the path of keys to migrate
  ipcMain.handle(createChannelName('getDataMigrationKeysPath'), async (): Promise<string> => {
    return getDataMigrationKeysPath();
  });

  // Decrypts the encrypted key in the given file path
  ipcMain.handle(
    createChannelName('migrateUserData'),
    async (_e, userId: string): Promise<MigrateUserDataResult> => {
      return migrateUserData(userId);
    },
  );
};
