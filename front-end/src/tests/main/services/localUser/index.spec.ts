import { expect, vi } from 'vitest';

import { getUserStorageFolderPath, resetData } from '@main/services/localUser/index';

import { session } from 'electron';
import initDatabase, { deleteDatabase } from '@main/db/init';
import { createPrismaClient, setPrismaClient } from '@main/db/prisma';

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
}));
vi.mock('@main/db/init', () => {
  return {
    default: vi.fn(),
    deleteDatabase: vi.fn(),
  };
});

describe('Services Local User Transactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('resetData', () => {
    beforeEach(() => {
      vi.resetAllMocks();
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

      const firstResetData = resetData();
      const secondResetData = resetData();

      expect(firstResetData).toStrictEqual(secondResetData);

      resolve!();

      await firstResetData;
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
