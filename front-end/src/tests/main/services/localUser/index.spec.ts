import { expect, vi } from 'vitest';

import { getUserStorageFolderPath, resetData, resetDatabase } from '@main/services/localUser';

import { session } from 'electron';
import initDatabase, { deleteDatabase } from '@main/db/init';
import { createPrismaClient, setPrismaClient } from '@main/db/prisma';
import { getSessionPartitionName } from '@main/utils/playwrightIsolation';

// Mock all sub-modules re-exported via `export *` in index.ts.
// Explicit factory `() => ({})` is required — without it, Vitest loads the real
// module for auto-mock generation, which triggers @hiero-ledger/sdk and other
// native/heavy imports that crash the worker process (ERR_IPC_CHANNEL_CLOSED).
vi.mock('@main/services/localUser/auth', () => ({}));
vi.mock('@main/services/localUser/keyPairs', () => ({}));
vi.mock('@main/services/localUser/accounts', () => ({}));
vi.mock('@main/services/localUser/files', () => ({}));
vi.mock('@main/services/localUser/transactions', () => ({}));
vi.mock('@main/services/localUser/transactionDrafts', () => ({}));
vi.mock('@main/services/localUser/transactionGroups', () => ({}));
vi.mock('@main/services/localUser/complexKeys', () => ({}));
vi.mock('@main/services/localUser/organizations', () => ({}));
vi.mock('@main/services/localUser/organizationCredentials', () => ({}));
vi.mock('@main/services/localUser/contacts', () => ({}));
vi.mock('@main/services/localUser/encryptedKeys', () => ({}));
vi.mock('@main/services/localUser/dataMigration', () => ({}));
vi.mock('@main/services/localUser/sdk', () => ({}));
vi.mock('@main/services/localUser/mnemonic', () => ({}));
vi.mock('@main/services/localUser/publicKeyMapping', () => ({}));

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  session: {
    fromPartition: vi.fn().mockReturnValue({
      clearStorageData: vi.fn(),
    }),
  },
}));
vi.mock('@main/db/prisma', () => ({
  createPrismaClient: vi.fn(),
  setPrismaClient: vi.fn(),
  getPrismaClient: vi.fn(),
}));
vi.mock('@main/db/init', () => {
  return {
    default: vi.fn(),
    deleteDatabase: vi.fn(),
  };
});
vi.mock('@main/utils/playwrightIsolation', () => ({
  getSessionPartitionName: vi.fn().mockReturnValue('persist:main'),
}));

describe('Services Local User Transactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('resetData', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(getSessionPartitionName).mockReturnValue('persist:main');
    });

    test('Should clear storage data, delete and initialize the database', async () => {
      const clearStorageDataMock = vi.fn();
      vi.spyOn(session, 'fromPartition').mockReturnValue({
        clearStorageData: clearStorageDataMock,
      } as unknown as Electron.Session);

      await resetData();

      expect(session.fromPartition).toHaveBeenCalledWith('persist:main');
      expect(clearStorageDataMock).toHaveBeenCalled();
      expect(deleteDatabase).toHaveBeenCalled();
      expect(createPrismaClient).toHaveBeenCalled();
      expect(setPrismaClient).toHaveBeenCalled();
      expect(initDatabase).toHaveBeenCalled();
    });

    test('Should clear delete and initialize the database', async () => {
      vi.spyOn(session, 'fromPartition').mockReturnValue(null as unknown as Electron.Session);

      await resetData();

      expect(deleteDatabase).toHaveBeenCalled();
      expect(createPrismaClient).toHaveBeenCalled();
      expect(setPrismaClient).toHaveBeenCalled();
      expect(initDatabase).toHaveBeenCalled();
    });

    test('Should not reset the database if it is already being reset', async () => {
      let resolve: () => void;
      const promise = new Promise<void>(r => {
        resolve = r;
      });

      vi.mocked(deleteDatabase).mockImplementation(() => {
        return promise;
      });

      // The guard lives in resetDatabase — calling it twice while in progress
      // should only trigger one actual DB deletion.
      const firstReset = resetDatabase();
      const secondReset = resetDatabase();

      expect(await secondReset).toBeUndefined();
      expect(deleteDatabase).toHaveBeenCalledTimes(1);

      resolve!();

      await firstReset;
    });
  });

  describe('getUserStorageFolderPath', () => {
    test('Should return the user storage folder path', () => {
      const email = 'some@email';

      const result = getUserStorageFolderPath(email);

      expect(result).toBe('User Storage/some@email');
    });
  });
});
