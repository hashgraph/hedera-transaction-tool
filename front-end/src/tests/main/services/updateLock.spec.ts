import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockUnlinkSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync: mockUnlinkSync,
  };
});

import {
  createUpdateLock,
  removeUpdateLock,
  getUpdateLock,
  isUpdateLockStale,
} from '@main/services/updateLock';

describe('updateLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUpdateLock', () => {
    it('should write a lock file with version and timestamp', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      createUpdateLock('2.0.0');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('update.lock'),
        JSON.stringify({ version: '2.0.0', timestamp: now }),
        'utf-8',
      );
    });
  });

  describe('removeUpdateLock', () => {
    it('should delete the lock file if it exists', () => {
      mockUnlinkSync.mockReturnValue(undefined);

      removeUpdateLock();

      expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('update.lock'));
    });

    it('should not throw if the lock file does not exist (ENOENT)', () => {
      const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
      enoent.code = 'ENOENT';
      mockUnlinkSync.mockImplementation(() => {
        throw enoent;
      });

      expect(() => removeUpdateLock()).not.toThrow();
    });

    it('should re-throw non-ENOENT errors', () => {
      const eperm = new Error('EPERM') as NodeJS.ErrnoException;
      eperm.code = 'EPERM';
      mockUnlinkSync.mockImplementation(() => {
        throw eperm;
      });

      expect(() => removeUpdateLock()).toThrow('EPERM');
    });
  });

  describe('getUpdateLock', () => {
    it('should return null if the lock file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(getUpdateLock()).toBeNull();
    });

    it('should return parsed lock data if the file exists and is valid', () => {
      const lockData = { version: '2.0.0', timestamp: 1000 };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(lockData));

      expect(getUpdateLock()).toEqual(lockData);
    });

    it('should return null if the file contains invalid JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not-json');

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null if version is missing', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ timestamp: 1000 }));

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null if timestamp is missing', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '2.0.0' }));

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null if version is not a string', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: 123, timestamp: 1000 }));

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null if timestamp is not a number', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '2.0.0', timestamp: 'abc' }));

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null for an empty object', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      expect(getUpdateLock()).toBeNull();
    });

    it('should return null for an array', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([]));

      expect(getUpdateLock()).toBeNull();
    });
  });

  describe('isUpdateLockStale', () => {
    it('should return false if no lock exists and none is passed', () => {
      mockExistsSync.mockReturnValue(false);

      expect(isUpdateLockStale()).toBe(false);
    });

    it('should return false if null lock is passed', () => {
      expect(isUpdateLockStale(null)).toBe(false);
    });

    it('should return false if the lock is within the max age', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ version: '2.0.0', timestamp: now - 5 * 60 * 1000 }),
      );

      expect(isUpdateLockStale()).toBe(false);
    });

    it('should return true if the lock is older than the max age', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ version: '2.0.0', timestamp: now - 11 * 60 * 1000 }),
      );

      expect(isUpdateLockStale()).toBe(true);
    });

    it('should use custom max age when provided', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ version: '2.0.0', timestamp: now - 3000 }),
      );

      expect(isUpdateLockStale(undefined, 2000)).toBe(true);
      expect(isUpdateLockStale(undefined, 5000)).toBe(false);
    });

    it('should use a pre-read lock when provided', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const lock = { version: '2.0.0', timestamp: now - 11 * 60 * 1000 };
      expect(isUpdateLockStale(lock)).toBe(true);

      // Should NOT read from disk
      expect(mockExistsSync).not.toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should use pre-read lock with custom max age', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const lock = { version: '2.0.0', timestamp: now - 3000 };
      expect(isUpdateLockStale(lock, 2000)).toBe(true);
      expect(isUpdateLockStale(lock, 5000)).toBe(false);
    });
  });
});
