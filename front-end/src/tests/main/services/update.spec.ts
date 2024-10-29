import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { app, BrowserWindow } from 'electron';

import { LatestYML, Updater } from '@main/services/update';

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
      vi.spyOn(Updater, 'readLatestMacYml').mockResolvedValue(null);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should not proceed if files verification fails', async () => {
      const updateData: LatestYML = { version: '1.1.0', files: ['file1', 'file2'] };
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'readLatestMacYml').mockResolvedValue(updateData);
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'verifyFiles').mockResolvedValue(false);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should send update message if a newer version is available', async () => {
      const updateData: LatestYML = { version: '1.1.0', files: ['file1', 'file2'] };
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'readLatestMacYml').mockResolvedValue(updateData);
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'verifyFiles').mockResolvedValue(true);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:check-for-update-result',
        '1.1.0',
      );
    });

    it('should not send update message if the current version is up-to-date', async () => {
      const updateData: LatestYML = { version: '1.0.0', files: ['file1', 'file2'] };
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'readLatestMacYml').mockResolvedValue(updateData);
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'verifyFiles').mockResolvedValue(true);
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('readLatestMacYml', () => {
    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should return null if the file cannot be read', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      //@ts-expect-error - Testing private method
      const result = await Updater.readLatestMacYml('/path/to/location');
      expect(result).toBeNull();
    });

    it('should return parsed data if the file is read successfully', async () => {
      const fileContent = `
version: 1.1.0
files:
  - url: file1
  - url: file2
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);
      //@ts-expect-error - Testing private method
      const result = await Updater.readLatestMacYml('/path/to/location');
      expect(result).toEqual({ version: '1.1.0', files: ['file1', 'file2'] });
    });

    it('should return null if the version is not found', async () => {
      const fileContent = `
files:
  - url: file1
  - url: file2
`;
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);
      //@ts-expect-error - Testing private method
      const result = await Updater.readLatestMacYml('/path/to/location');
      expect(result).toBeNull();
    });
  });

  describe('verifyFiles', () => {
    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should return true if all files are present', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file1', 'file2'] as any);
      //@ts-expect-error - Testing private method
      const result = await Updater.verifyFiles('/path/to/location', ['file1', 'file2']);
      expect(result).toBe(true);
    });

    it('should return false if any file is missing', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file1'] as any);
      //@ts-expect-error - Testing private method
      const result = await Updater.verifyFiles('/path/to/location', ['file1', 'file2']);
      expect(result).toBe(false);
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
  });
});
