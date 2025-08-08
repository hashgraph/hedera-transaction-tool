import type { MigrateUserDataResult } from '@shared/interfaces/migration';

import { ipcRenderer } from 'electron';

export default {
  dataMigration: {
    locateDataMigrationFiles: (): Promise<boolean> =>
      ipcRenderer.invoke('dataMigration:locateDataMigrationFiles'),
    decryptMigrationMnemonic: (password: string): Promise<string[] | null> =>
      ipcRenderer.invoke('dataMigration:decryptMigrationMnemonic', password),
    getDataMigrationKeysPath: (): Promise<string> =>
      ipcRenderer.invoke('dataMigration:getDataMigrationKeysPath'),
    migrateUserData: (userId: string): Promise<MigrateUserDataResult> =>
      ipcRenderer.invoke('dataMigration:migrateUserData', userId),
  },
};
