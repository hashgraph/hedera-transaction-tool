import { ipcRenderer } from 'electron';
import { Network } from '@main/shared/enums';

export default {
  dataMigration: {
    locateDataMigrationFiles: (): Promise<boolean> =>
      ipcRenderer.invoke('dataMigration:locateDataMigrationFiles'),
    decryptMigrationMnemonic: (password: string): Promise<string[] | null> =>
      ipcRenderer.invoke(
        'dataMigration:decryptMigrationMnemonic',
        password,
      ),
    getDataMigrationKeysPath: (): Promise<string> =>
      ipcRenderer.invoke('dataMigration:getDataMigrationKeysPath'),
    migrateAccountsData: (userId: string, network: Network): Promise<number> =>
      ipcRenderer.invoke(
        'dataMigration:migrateAccountsData',
        userId,
        network,
      ),
  },
};
