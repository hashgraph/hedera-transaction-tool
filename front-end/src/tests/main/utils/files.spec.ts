import { expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

import * as unzipper from 'unzipper';

import * as files from '@main/utils/files';
import { abortFileSearch } from '@main/utils/files';

const readStream = {
  on: vi.fn((event, callback) => {
    if (event === 'data') callback(); // Simulate data event
    return readStream;
  }),
  pipe: vi.fn(() => writeStream),
  destroy: vi.fn(),
};

const writeStream = {
  on: vi.fn((event, callback) => {
    if (event === 'finish') callback(); // Simulate finish event
    return writeStream;
  }),
  destroy: vi.fn(),
};

vi.mock('fs', () => {
  return {
    createReadStream: vi.fn(() => readStream),
    createWriteStream: vi.fn(() => writeStream),
    constants: { F_OK: 0 },
  };
});
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

// then change files to separate out the functions or turn it into a class, then fix tests again
describe('Files utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchFiles', () => {
    const extensions = ['.pub'];
    const processor = vi.fn(async (filePath: string) => [{ file: filePath }]);

    beforeEach(() => {
      vi.resetAllMocks();

      vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
    });

    test('Should create search directory', async () => {
      await files.searchFiles(['/some/path'], extensions, processor);
      expect(fsp.mkdir).toHaveBeenCalled();
    });

    test('Should process a file with supported extension', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      });
      vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));

      processor.mockResolvedValue({ file: '/file.pub' });
      const result = await files.searchFiles(['/file.pub'], extensions, processor);
      expect(processor).toHaveBeenCalledWith(expect.stringMatching(/\/file\.pub$/));
      expect(result).toEqual([{ file: '/file.pub' }]);
    });

    test('Should process a directory and recurse into files', async () => {
      vi.mocked(fsp.stat).mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as any);
      vi.mocked(fsp.readdir).mockResolvedValue(['file1.pub', 'file2.pub']);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      vi.mocked(path.extname).mockImplementation((filePath: string) =>
        filePath.endsWith('.pub') ? '.pub' : '.enc'
      );
      vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));
      processor.mockResolvedValueOnce({ file: '/dir/file1.pub' });
      processor.mockResolvedValueOnce({ file: '/dir/file2.pub' });
      const result = await files.searchFiles(['/dir'], extensions, processor);
      expect(fsp.readdir).toHaveBeenCalledWith('/dir');
      expect(result).toEqual([{ file: '/dir/file1.pub' }, { file: '/dir/file2.pub' }]);
    });

    test('Should handles errors in processor gracefully', async () => {
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      });
      vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));
      vi.mocked(fsp.rm).mockResolvedValue(undefined);
      processor.mockRejectedValue(new Error('Processing error'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await files.searchFiles(['/file.pub'], extensions, processor);
      expect(fsp.rm).toHaveBeenCalledWith(expect.stringMatching(/\/file\.pub$/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Error processing file/), expect.any(Error));
      expect(result).toEqual([]);
    });

    test('Should handle errors in recursiveSearch gracefully', async () => {
      vi.mocked(fsp.stat).mockRejectedValue(new Error('stat error'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await files.searchFiles(['/badfile'], extensions, processor);
      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('Should handle errors in directory reading gracefully', async () => {
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

    describe('Zip import and abort cleanup', () => {
      let mockStream: any;
      let mockFile: any;
      let error: Error;

      beforeEach(() => {
        vi.resetAllMocks();

        vi.mocked(path.extname).mockReturnValue('.pub');
        vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));

        mockStream = {
          on: vi.fn((event, callback) => {
            if (event === 'data' || event === 'close') setTimeout(callback, 0);
            if (event === 'error') return this;
            return mockStream;
          }),
          pipe: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };

        mockFile = {
          path: 'file1.pub',
          stream: vi.fn(() => mockStream),
        };

        vi.mocked(unzipper.Open.file).mockResolvedValue({
          files: [mockFile],
        } as any);
        vi.mocked(fsp.stat)
          .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any)
          .mockResolvedValueOnce({ isFile: () => false, isDirectory: () => true } as any)
          .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any);
        vi.mocked(path.extname).mockImplementation((filePath: string) => {
          if (filePath === '/archive.zip') return '.zip';
          if (filePath.endsWith('.pub')) return '.pub';
          return '';
        });
        vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));
        vi.mocked(fsp.readdir).mockResolvedValue(['file1.pub']);
      });

      test('Should process a zip file', async () => {
        processor.mockResolvedValue({ file: '/tmp/unzipped_123/file1.pub' });
        const result = await files.searchFiles(['/archive.zip'], extensions, processor);
        expect(unzipper.Open.file).toHaveBeenCalled();
        expect(result).toEqual([{ file: '/tmp/unzipped_123/file1.pub' }]);
      });

      test('Should abort unzipping if signal is aborted', async () => {
        let callCount = 0;
        vi.mocked(path.join).mockImplementation((...args) => {
          callCount++;
          if (callCount === 3) {
            // abort when creating the unzip dir
            abortFileSearch();
          }
          return args.join('/');
        });
        vi.mocked(fsp.rm).mockResolvedValue(undefined);
        const results = await files.searchFiles(['/archive.zip'], extensions, processor);

        expect(mockStream.destroy).toHaveBeenCalled();
        expect(results).toEqual([]);
      });

      test('Should cleanup temp directories on abort', async () => {
        vi.mocked(fsp.rm).mockResolvedValue(undefined);
        processor.mockImplementation(async (filePath: string) => {
          abortFileSearch();
          return filePath;
        });
        const results = await files.searchFiles(['/archive.zip'], extensions, processor);
        expect(fsp.rm).toHaveBeenCalledWith(expect.stringMatching(/^\/tmp\/search_/), { recursive: true });
        expect(fsp.rm).toHaveBeenCalledWith(expect.stringMatching(/^\/tmp\/unzipped_/), { recursive: true });
        expect(results).toEqual([]);
      });

      test('Should log errors if directories fail to delete', async () => {
        error = new Error('Failed to delete');
        vi.mocked(fsp.rm).mockImplementation(dir => {
          if (typeof dir === 'string' && dir.startsWith('/tmp/unzipped_')) {
            return Promise.reject(error);
          }
          return Promise.resolve();
        });
        processor.mockImplementation(async (filePath: string) => {
          abortFileSearch();
          return filePath;
        });

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const results = await files.searchFiles(['/archive.zip'], extensions, processor);

        expect(fsp.rm).toHaveBeenCalledWith(expect.stringMatching(/^\/tmp\/search_/), { recursive: true });
        expect(fsp.rm).toHaveBeenCalledWith(expect.stringMatching(/^\/tmp\/unzipped_/), { recursive: true });

        expect(consoleSpy).toHaveBeenCalledWith('Delete search dirs error:', error);
        expect(results).toEqual([]);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('copyFile', () => {
    test('Should copy file with stream', async () => {
      const filePath = '/path/to/source/file.txt';
      const fileDist = '/path/to/dest/file.txt';

      await files.copyFile(filePath, fileDist);

      expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
      expect(fs.createWriteStream).toHaveBeenCalledWith(fileDist);
      expect(readStream.pipe).toHaveBeenCalledWith(writeStream);
      expect(writeStream.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    test('Should handle abort state during file copy', async () => {
      const filePath = '/path/to/source/file.txt';
      const fileDist = '/path/to/dest/file.txt';
      const signal = { aborted: true };

      await expect(files.copyFile(filePath, fileDist, signal)).rejects.toEqual('File copying aborted');

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

      vi.mocked(fsp.access).mockRejectedValue(new Error('File does not exist'));

      const result = await files.getUniquePath(dist, fileName);

      expect(result).toEqual(fileDist);
      expect(fsp.access).toHaveBeenCalledWith(fileDist, fs.constants.F_OK);
    });

    test('Should return unique file path with incremented name', async () => {
      const dist = '/path/to/dist';
      const fileName = 'file.txt';
      const fileDist1 = path.join(dist, fileName);
      const fileDist2 = path.join(dist, 'copy_1_file.txt');

      vi.mocked(fsp.access)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File does not exist'));

      const result = await files.getUniquePath(dist, fileName);

      expect(result).toEqual(fileDist2);
      expect(fsp.access).toHaveBeenCalledWith(fileDist1, fs.constants.F_OK);
      expect(fsp.access).toHaveBeenCalledWith(fileDist2, fs.constants.F_OK);
    });
  });
});
