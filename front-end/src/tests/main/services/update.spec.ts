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
      //@ts-expect-error - Testing private method
      vi.spyOn(Updater, 'getFileForPlatform').mockImplementationOnce(() => 'artifact');
      await Updater.checkForUpdate('/path/to/location');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'update:check-for-update-result',
        'artifact',
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

  describe('getFileForPlatform', () => {
    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should return the correct file for the current platform', () => {
      const files = ['file1-x64', 'file2-arm64'];
      const originalArch = process.arch;
      Object.defineProperty(process, 'arch', { value: 'x64' });
      //@ts-expect-error - Testing private method
      const result = Updater.getFileForPlatform(files);
      expect(result).toBe('file1-x64');
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return null if no file matches the current platform', () => {
      const files = ['file1-x64', 'file2-arm64'];
      const originalArch = process.arch;
      Object.defineProperty(process, 'arch', { value: 'ia32' });
      //@ts-expect-error - Testing private method
      const result = Updater.getFileForPlatform(files);
      expect(result).toBeNull();
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return the first matching file if multiple files match the current platform', () => {
      const files = ['file1-x64', 'file2-x64'];
      const originalArch = process.arch;
      Object.defineProperty(process, 'arch', { value: 'x64' });
      //@ts-expect-error - Testing private method
      const result = Updater.getFileForPlatform(files);
      expect(result).toBe('file1-x64');
      Object.defineProperty(process, 'arch', { value: originalArch });
    });
  });
});
