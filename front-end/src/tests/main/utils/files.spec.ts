import { expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

import * as unzipper from 'unzipper';

import * as files from '@main/utils/files';
import { AbortableState } from '@main/services/localUser';

vi.mock('fs');
vi.mock('fs/promises');
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  extname: vi.fn((filePath: string) => filePath.slice(filePath.lastIndexOf('.'))),
  basename: vi.fn((filePath: string) => filePath.split('/').pop()),
}));
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
}));
vi.mock('unzipper');

// const mockStream = {
//   on: vi.fn((event, callback) => {
//     if (event === 'close') setTimeout(callback, 0);
//     return mockStream;
//   }),
//   pipe: vi.fn().mockReturnThis(),
// };
//
// const mockFile = {
//   path: 'file1.pub',
//   stream: vi.fn(() => mockStream),
// };

describe('Files utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchFiles', () => {
    const extensions = ['.pub'];
    const processor = vi.fn(async (filePath: string) => [{ file: filePath }]);
    let uniquePath = '';

    beforeEach(() => {
      vi.resetAllMocks();
      uniquePath = '/tmp/unzipped_123';

      // Mock copyFile and getUniquePath
      // vi.spyOn(files, 'copyFile').mockImplementation(() => Promise.resolve('mockedDist'));
      // vi.spyOn(files, 'getUniquePath').mockImplementation(() => Promise.resolve('/tmp/unzipped_123'));
      // vi.spyOn(files, 'copyFile').mockReturnValue(Promise.resolve('mockedDist'));
      // vi.spyOn(files, 'getUniquePath').mockImplementation(() => Promise.resolve('/tmp/unzipped_123'));

      // Other mocks as needed
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      });
      vi.mocked(path.extname).mockReturnValue('.pub');
      vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));
      // vi.mocked(unzipper.Open.file).mockResolvedValue({
      //   files: [mockFile],
      // } as any);
    });

    test('Should create search directory', async () => {
      await files.searchFiles(['/some/path'], extensions, processor);
      expect(fsp.mkdir).toHaveBeenCalled();
    });

    test('Should process a file with supported extension', async () => {
      vi.fn().mockImplementation(files.copyFile).mockImplementationOnce(() => Promise.resolve('mockedDist'));
      processor.mockResolvedValue([{ file: '/file.pub' }]);
      const result = await files.searchFiles(['/file.pub'], extensions, processor);
      expect(processor).toHaveBeenCalledWith('/file.pub');
      expect(result).toEqual([{ file: '/file.pub' }]);
    });

    test('Should process a directory and recurse into files', async () => {
      vi.mocked(fsp.stat).mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      vi.mocked(fsp.readdir).mockResolvedValue(['file1.pub', 'file2.enc']);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      vi.mocked(path.extname).mockImplementation((filePath: string) =>
        filePath.endsWith('.pub') ? '.pub' : '.enc'
      );
      processor.mockResolvedValue([{ file: '/dir/file1.pub' }, { file: '/dir/file2.enc' }]);
      const result = await files.searchFiles(['/dir'], extensions, processor);
      expect(fsp.readdir).toHaveBeenCalledWith('/dir');
      expect(result).toEqual([{ file: '/dir/file1.pub' }, { file: '/dir/file2.enc' }]);
    });

    test('Should process a zip file', async () => {
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat)
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any)
        .mockResolvedValueOnce({ isFile: () => false, isDirectory: () => true } as any)
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any);
      vi.mocked(path.extname).mockImplementation((filePath: string) => {
        if (filePath === '/archive.zip') return '.zip';
        if (filePath.endsWith('.pub')) return '.pub';
        return '';
      });

      vi.mocked(fsp.readdir).mockResolvedValue(['file1.pub']);
      processor.mockResolvedValue([{ file: '/tmp/unzipped_123/file1.pub' }]);
      const result = await files.searchFiles(['/archive.zip'], extensions, processor);
      expect(unzipper.Open.file).toHaveBeenCalled();
      expect(result).toEqual([{ file: '/tmp/unzipped_123/file1.pub' }]);
    });

    test('Should abort search and cleanup if signal is aborted', async () => {
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat).mockImplementation(() => {
        abortFileSearch();
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        } as any);
      });
      vi.mocked(path.extname).mockReturnValue('.pub');
      processor.mockResolvedValue([{ file: '/file.pub' }]);
      vi.mocked(fsp.rm).mockResolvedValue(undefined);
      const result = await files.searchFiles(['/file.pub'], extensions, processor);
      expect(result).toEqual([]);
      expect(fsp.rm).toHaveBeenCalled();
    });

    test('Should handle errors in recursiveSearch gracefully', async () => {
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat).mockRejectedValue(new Error('stat error'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await files.searchFiles(['/badfile'], extensions, processor);
      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('Should handle errors in directory reading gracefully', async () => {
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat).mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      vi.mocked(fsp.readdir).mockRejectedValue(new Error('readdir error'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await files.searchFiles(['/dir'], extensions, processor);
      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('Should cleanup temp directories on abort', async () => {
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsp.stat).mockImplementation(() => {
        abortFileSearch();
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
        } as any);
      });
      vi.mocked(path.extname).mockReturnValue('.pub');
      processor.mockResolvedValue([{ file: '/file.pub' }]);
      vi.mocked(fsp.rm).mockResolvedValue(undefined);
      await files.searchFiles(['/file.pub'], extensions, processor);
      expect(fsp.rm).toHaveBeenCalled();
    });


  });

  describe('copyFile', () => {
    test('Should copy file with stream', async () => {
      const filePath = '/path/to/source/file.txt';
      const fileDist = '/path/to/dest/file.txt';
      const state: AbortableState = { aborted: false };
      const readStream = { on: vi.fn(), pipe: vi.fn() };
      const writeStream = { on: vi.fn() };

      vi.spyOn(fs, 'createReadStream').mockReturnValue(readStream as any);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(writeStream as any);
      readStream.pipe.mockReturnValue(writeStream);
      writeStream.on.mockImplementation((event, callback) => {
        if (event === 'finish') callback();
        return writeStream;
      });

      await files.copyFile(filePath, fileDist, state);

      expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
      expect(fs.createWriteStream).toHaveBeenCalledWith(fileDist);
      expect(readStream.pipe).toHaveBeenCalledWith(writeStream);
      expect(writeStream.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    test('Should handle abort state during file copy', async () => {
      const filePath = '/path/to/source/file.txt';
      const fileDist = '/path/to/dest/file.txt';
      const state: AbortableState = { aborted: true };
      const readStream = { on: vi.fn(), pipe: vi.fn(), destroy: vi.fn() };
      const writeStream = { on: vi.fn() };

      vi.spyOn(fs, 'createReadStream').mockReturnValue(readStream as any);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(writeStream as any);
      readStream.pipe.mockReturnValue(writeStream);
      readStream.on.mockImplementation((event, callback) => {
        if (event === 'data') callback();
        return readStream;
      });

      await expect(files.copyFile(filePath, fileDist, state)).rejects.toEqual('File copying aborted');

      expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
      expect(fs.createWriteStream).toHaveBeenCalledWith(fileDist);
      expect(readStream.pipe).toHaveBeenCalledWith(writeStream);
      expect(readStream.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(readStream.destroy).toHaveBeenCalled();
    });
  });

  describe('getUniquePath', () => {
    test('Should return unique file path', async () => {
      const dist = '/path/to/dist';
      const fileName = 'file.txt';
      const fileDist = path.join(dist, fileName);

      vi.spyOn(fsp, 'access').mockRejectedValue(new Error('File does not exist'));

      const result = await files.getUniquePath(dist, fileName);

      expect(result).toEqual(fileDist);
      expect(fsp.access).toHaveBeenCalledWith(fileDist, fs.constants.F_OK);
    });

    test('Should return unique file path with incremented name', async () => {
      const dist = '/path/to/dist';
      const fileName = 'file.txt';
      const fileDist1 = path.join(dist, fileName);
      const fileDist2 = path.join(dist, 'copy_1_file.txt');

      vi.spyOn(fsp, 'access')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File does not exist'));

      const result = await files.getUniquePath(dist, fileName);

      expect(result).toEqual(fileDist2);
      expect(fsp.access).toHaveBeenCalledWith(fileDist1, fs.constants.F_OK);
      expect(fsp.access).toHaveBeenCalledWith(fileDist2, fs.constants.F_OK);
    });
  });
});
