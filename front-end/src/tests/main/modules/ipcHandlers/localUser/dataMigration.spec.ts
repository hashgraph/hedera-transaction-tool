import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerDataMigrationHandlers from '@main/modules/ipcHandlers/localUser/dataMigration';
import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateUserData,
} from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers Data Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDataMigrationHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = [
      'locateDataMigrationFiles',
      'decryptMigrationMnemonic',
      'getDataMigrationKeysPath',
      'migrateUserData',
    ];
    expect(events.every(util => getIPCHandler(`dataMigration:${util}`))).toBe(true);
  });

  test('Should set up locateDataMigrationFiles handler', async () => {
    await invokeIPCHandler('dataMigration:locateDataMigrationFiles');
    expect(locateDataMigrationFiles).toHaveBeenCalled();
  });

  test('Should set up decryptMigrationMnemonic handler', async () => {
    await invokeIPCHandler('dataMigration:decryptMigrationMnemonic', 'password');
    expect(decryptMigrationMnemonic).toHaveBeenCalledWith('password');
  });

  test('Should set up getDataMigrationKeysPath handler', async () => {
    await invokeIPCHandler('dataMigration:getDataMigrationKeysPath');
    expect(getDataMigrationKeysPath).toHaveBeenCalled();
  });

  test('Should set up migrateUserData handler', async () => {
    await invokeIPCHandler('dataMigration:migrateUserData', 'userId');
    expect(migrateUserData).toHaveBeenCalledWith('userId');
  });
});
