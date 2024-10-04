import { ipcMain } from 'electron';
import registerDataMigrationHandlers from '@main/modules/ipcHandlers/localUser/dataMigration';
import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  migrateUserData,
} from '@main/services/localUser';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  locateDataMigrationFiles: vi.fn(),
  decryptMigrationMnemonic: vi.fn(),
  getDataMigrationKeysPath: vi.fn(),
  migrateUserData: vi.fn(),
}));

describe('IPC handlers Data Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDataMigrationHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = [
      'locateDataMigrationFiles',
      'decryptMigrationMnemonic',
      'getDataMigrationKeysPath',
      'migrateUserData',
    ];

    expect(
      events.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `dataMigration:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up locateDataMigrationFiles handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'dataMigration:locateDataMigrationFiles',
    );
    expect(handler).toBeDefined();

    handler && (await handler[1](event));
    expect(locateDataMigrationFiles).toHaveBeenCalled();
  });

  test('Should set up decryptMigrationMnemonic handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'dataMigration:decryptMigrationMnemonic',
    );
    expect(handler).toBeDefined();

    const password = 'password';

    handler && (await handler[1](event, password));
    expect(decryptMigrationMnemonic).toHaveBeenCalledWith(password);
  });

  test('Should set up getDataMigrationKeysPath handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'dataMigration:getDataMigrationKeysPath',
    );
    expect(handler).toBeDefined();

    handler && (await handler[1](event));
    expect(getDataMigrationKeysPath).toHaveBeenCalled();
  });

  test('Should set up migrateUserData handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'dataMigration:migrateUserData',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';

    handler && (await handler[1](event, userId));
    expect(migrateUserData).toHaveBeenCalledWith(userId);
  });
});
