import { ipcMain } from 'electron';

import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateAccountsData,
} from '@main/services/localUser';
import { Network } from '@main/shared/enums';

const createChannelName = (...props) => ['dataMigration', ...props].join(':');

export default () => {
  // // Searches for encrypted keys in the given file paths
  // ipcMain.handle(createChannelName('migrate'), async (_e, filePaths: string[]) => {
  //   const encryptedFilesExtension = ['.pem'];
  //
  //   const abortable = new Abortable(searchEncryptedKeysAbort);
  //   const searcher = new EncryptedKeysSearcher(abortable, encryptedFilesExtension);
  //
  //   return await searcher.search(filePaths);
  // });
  //
  // // Aborts the search for encrypted keys
  // ipcMain.on(createChannelName('migrate:abort'), () => {
  //   getFileStreamEventEmitter().emit(searchEncryptedKeysAbort);
  // });

  // Locates the data migration files
  ipcMain.handle(createChannelName('locateDataMigrationFiles'),
    async (): Promise<boolean> => {
      return locateDataMigrationFiles();
    },
  );

  // Decrypts the encrypted key in the given file path
  ipcMain.handle(createChannelName('decryptMigrationMnemonic'),
    async (_e, password: string): Promise<string[] | null> => {
      return decryptMigrationMnemonic(password);
    },
  );

  ipcMain.handle(createChannelName('getDataMigrationKeysPath'),
    async (): Promise<string> => {
      return getDataMigrationKeysPath();
    },
  );

  // Decrypts the encrypted key in the given file path
  ipcMain.handle(createChannelName('migrateAccountsData'),
    async (_e, userId: string, network: Network): Promise<number> => {
      return migrateAccountsData(userId, network);
    },
  );
};
