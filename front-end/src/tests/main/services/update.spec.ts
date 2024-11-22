import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { app, BrowserWindow } from 'electron';

import { NewVersion, Updater } from '@main/services/update';

vi.mock('fs/promises');
vi.mock('electron', () => ({
  app: { getVersion: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn() },
}));

describe('Updater', () => {
  let mockWindow: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };

    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow]);
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');
  });

  describe('checkForUpdate', () => {
    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should not proceed if no window is available', async () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should not proceed if update data is null', async () => {
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'checkLocation').mockResolvedValue(null);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should send update message if a newer version is available', async () => {
      const updateData: NewVersion = { version: '1.1.0', file: 'file1' };
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'checkLocation').mockResolvedValue(updateData);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:check-for-update-result',
        'file1',
      );
    });

    it('should not send update message if the current version is up-to-date', async () => {
      const updateData: NewVersion = { version: '1.0.0', file: 'file1' };
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'checkLocation').mockResolvedValue(updateData);
      vi.mocked(app.getVersion).mockReturnValue('1.0.0');
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('checkLocation', () => {
    it('should return null if no matching file is found', async () => {
      //@ts-expect-error
      vi.mocked(fs.readdir).mockResolvedValue(['some-other-file.txt']);
      //@ts-expect-error - Testing private method
      const result = await Updater.checkLocation('/path/to/location');
      expect(result).toBeNull();
    });

    it('should return null if an error occurs', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Failed to read directory'));
      //@ts-expect-error - Testing private method
      const result = await Updater.checkLocation('/path/to/location');
      expect(result).toBeNull();
    });

    it('should return update data if a matching file for MAC is found', async () => {
      //@ts-expect-error
      vi.mocked(fs.readdir).mockResolvedValue(['hedera-transaction-tool-1.1.0-mac-universal.pkg']);
      //@ts-expect-error - Testing private method
      const result = await Updater.checkLocation('/path/to/location');
      expect(result).toEqual({
        version: '1.1.0',
        file: 'hedera-transaction-tool-1.1.0-mac-universal.pkg',
      });
    });

    it('should return update data if a matching file for MAC is found', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.mocked(fs.readdir).mockResolvedValue([
        //@ts-expect-error
        'hedera-transaction-tool-1.1.0-win32-universal.pkg',
      ]);
      //@ts-expect-error - Testing private method
      const result = await Updater.checkLocation('/path/to/location');
      expect(result).toEqual({
        version: '1.1.0',
        file: 'hedera-transaction-tool-1.1.0-win32-universal.pkg',
      });
    });

    it('should return update data if a matching file for MAC is found', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.mocked(fs.readdir).mockResolvedValue([
        //@ts-expect-error
        'hedera-transaction-tool-1.1.0-linux-universal.pkg',
      ]);
      //@ts-expect-error - Testing private method
      const result = await Updater.checkLocation('/path/to/location');
      expect(result).toEqual({
        version: '1.1.0',
        file: 'hedera-transaction-tool-1.1.0-linux-universal.pkg',
      });

      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });
  });

  describe('isNewerVersion', () => {
    it('should return true if the new version is newer', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.1.0', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return false if the new version is older', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('0.9.0', '1.0.0');
      expect(result).toBe(false);
    });

    it('should return false if the versions are the same', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0', '1.0.0');
      expect(result).toBe(false);
    });

    it('should return true if the new version has more parts and is newer', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0.1', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return false if the new version has more parts and is older', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0', '1.0.0.1');
      expect(result).toBe(false);
    });

    it('should return false if the new version has fewer parts and is newer', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0', '1.0.0');
      expect(result).toBe(false);
    });

    it('should return false if the new version has fewer parts and is older', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0', '1.0');
      expect(result).toBe(false);
    });

    it('should return true if the new version has a pre-release identifier and the current version does not', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.1-beta.1', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return false if the current version has a pre-release identifier and the new version does not', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0', '1.0.1-beta.1');
      expect(result).toBe(false);
    });

    it('should return true if the new version has a higher alphanumeric pre-release identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-beta.2', '1.0.0-beta.1');
      expect(result).toBe(true);
    });

    it('should return false if the new version has a lower alphanumeric pre-release identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-beta.1', '1.0.0-beta.2');
      expect(result).toBe(false);
    });

    it('should return true if the new version has a higher alphanumeric identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-rc.1', '1.0.0-beta.2');
      expect(result).toBe(true);
    });

    it('should return false if the new version has a lower alphanumeric identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-beta.2', '1.0.0-rc.1');
      expect(result).toBe(false);
    });

    it('should return true if the new version has a higher mixed alphanumeric identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-beta.10', '1.0.0-beta.2');
      expect(result).toBe(true);
    });

    it('should return false if the new version has a lower mixed alphanumeric identifier', () => {
      //@ts-expect-error - Testing private method
      const result = Updater.isNewerVersion('1.0.0-beta.2', '1.0.0-beta.10');
      expect(result).toBe(false);
    });
  });
});
