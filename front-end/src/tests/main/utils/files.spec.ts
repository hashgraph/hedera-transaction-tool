import { expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as unzipper from 'unzipper';

import {
  getFilePaths,
  unzip,
  extractUnzipperFile,
  copyFile,
  getUniquePath,
} from '@main/utils/files';
import { AbortableState } from '@main/services/localUser';

vi.mock('fs');
vi.mock('fs/promises');
vi.mock('unzipper');

describe('Files utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFilePaths', () => {
    test('Should return file paths for given extensions', async () => {
      const searchPath = '/path/to/search';
      const extensions = ['.txt', '.md'];
      const files = ['file1.txt', 'file2.md', 'file3.jpg'];

      vi.spyOn(fsp, 'readdir').mockResolvedValue(files as any);

      const result = await getFilePaths(searchPath, extensions);

      expect(result).toEqual([
        path.join(searchPath, 'file1.txt'),
        path.join(searchPath, 'file2.md'),
      ]);
    });
  });

  describe('unzip', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should unzip files to directory', async () => {
      const zipPath = '/path/to/zip.zip';
      const dist = '/path/to/dist';
      const extensions = ['.pem'];
      const state: AbortableState = { aborted: false };
      const files = [
        {
          path: 'file1.pem',
          stream: vi.fn(),
        },
        {
          path: 'file2.pem',
          stream: vi.fn(),
        },
        {
          path: 'file3.json',
          stream: vi.fn(),
        },
      ];

      const stream = { on: vi.fn(), pipe: vi.fn() };

      for (const file of files) {
        file.stream.mockReturnValue(stream);
        stream.pipe.mockImplementation(() => stream);
        stream.on.mockImplementation((event, callback) => {
          callback();
          return stream;
        });
      }

      vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(unzipper.Open, 'file').mockResolvedValue({ files } as any);
      vi.spyOn(fsp, 'access').mockRejectedValue(undefined);

      const result = await unzip(zipPath, dist, extensions, state);

      expect(result).toEqual(dist);
      expect(fsp.mkdir).toHaveBeenCalledWith(dist, { recursive: true });
      expect(unzipper.Open.file).toHaveBeenCalledWith(zipPath);
      expect(fsp.access).toHaveBeenCalledTimes(2);
    });

    test('Should handle abort state during unzip', async () => {
      const zipPath = '/path/to/zip.zip';
      const dist = '/path/to/dist';
      const extensions = ['.pem'];
      const state: AbortableState = { aborted: true };
      const files = [
        {
          path: 'file1.pem',
          stream: vi.fn(),
        },
        {
          path: 'file2.pem',
          stream: vi.fn(),
        },
      ];

      const stream = { on: vi.fn(), pipe: vi.fn() };

      for (const file of files) {
        file.stream.mockReturnValue(stream);
        stream.pipe.mockReturnValue(stream);
        stream.on.mockImplementation((event, callback) => {
          if (event === 'close') callback();
          return stream;
        });
      }

      vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(unzipper.Open, 'file').mockResolvedValue({ files } as any);

      const result = await unzip(zipPath, dist, extensions, state);

      expect(result).toEqual(dist);
      expect(fsp.mkdir).toHaveBeenCalledWith(dist, { recursive: true });
      expect(unzipper.Open.file).toHaveBeenCalledWith(zipPath);
    });

    test('Should continue with next file on error', async () => {
      const zipPath = '/path/to/zip.zip';
      const dist = '/path/to/dist';
      const extensions = ['.pem'];
      const state: AbortableState = { aborted: false };
      const files = [
        {
          path: 'file1.pem',
          stream: vi.fn(),
        },
        {
          path: 'file2.pem',
          stream: vi.fn(),
        },
      ];

      const stream = { on: vi.fn(), pipe: vi.fn() };

      for (const file of files) {
        file.stream.mockReturnValue(stream);
        stream.pipe.mockImplementation(() => stream);
        stream.on.mockImplementation((event, callback) => {
          if (event !== 'close') callback();

          return stream;
        });
      }

      vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(unzipper.Open, 'file').mockResolvedValue({ files } as any);
      vi.spyOn(fsp, 'access').mockRejectedValue(undefined);

      const result = await unzip(zipPath, dist, extensions, state);

      expect(result).toEqual(dist);
      expect(fsp.mkdir).toHaveBeenCalledWith(dist, { recursive: true });
      expect(unzipper.Open.file).toHaveBeenCalledWith(zipPath);
    });

    test('Should unzip every file if extensions is empty', async () => {
      const zipPath = '/path/to/zip.zip';
      const dist = '/path/to/dist';
      const extensions = [];
      const state: AbortableState = { aborted: false };
      const files = [
        {
          path: 'file1.pem',
          stream: vi.fn(),
        },
        {
          path: 'file2.pem',
          stream: vi.fn(),
        },
        {
          path: 'file3.json',
          stream: vi.fn(),
        },
      ];

      const stream = { on: vi.fn(), pipe: vi.fn() };

      for (const file of files) {
        file.stream.mockReturnValue(stream);
        stream.pipe.mockImplementation(() => stream);
        stream.on.mockImplementation((event, callback) => {
          if (event !== 'close') callback();

          return stream;
        });
      }

      vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(unzipper.Open, 'file').mockResolvedValue({ files } as any);
      vi.spyOn(fsp, 'access').mockRejectedValue(undefined);

      const result = await unzip(zipPath, dist, extensions, state);

      expect(result).toEqual(dist);
      expect(fsp.mkdir).toHaveBeenCalledWith(dist, { recursive: true });
      expect(unzipper.Open.file).toHaveBeenCalledWith(zipPath);
      expect(fsp.access).toHaveBeenCalledTimes(3);
    });
  });

  describe('extractUnzipperFile', () => {
    test('Should extract file with stream', async () => {
      const file = { stream: vi.fn() } as any;
      const dist = '/path/to/dist/file.pem';
      const state: AbortableState = { aborted: false };
      const stream = { on: vi.fn(), pipe: vi.fn() };

      file.stream.mockReturnValue(stream);
      stream.pipe.mockReturnValue(stream);
      stream.on.mockImplementation((event, callback) => {
        if (event === 'close') callback();
        return stream;
      });

      const result = await extractUnzipperFile(file, dist, state);

      expect(result).toEqual(dist);
      expect(file.stream).toHaveBeenCalled();
      expect(stream.pipe).toHaveBeenCalled();
      expect(stream.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('Should handle abort state during extraction', async () => {
      const file = { stream: vi.fn() } as any;
      const dist = '/path/to/dist/file.pem';
      const state: AbortableState = { aborted: true };
      const stream = { on: vi.fn(), pipe: vi.fn(), destroy: vi.fn() };

      file.stream.mockReturnValue(stream);
      stream.pipe.mockReturnValue(stream);
      stream.on.mockImplementation((event, callback) => {
        if (event === 'data') callback();
        return stream;
      });

      await expect(extractUnzipperFile(file, dist, state)).rejects.toEqual(
        'File extraction aborted',
      );

      expect(file.stream).toHaveBeenCalled();
      expect(stream.pipe).toHaveBeenCalled();
      expect(stream.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(stream.destroy).toHaveBeenCalled();
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

      await copyFile(filePath, fileDist, state);

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

      await expect(copyFile(filePath, fileDist, state)).rejects.toEqual('File copying aborted');

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

      const result = await getUniquePath(dist, fileName);

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

      const result = await getUniquePath(dist, fileName);

      expect(result).toEqual(fileDist2);
      expect(fsp.access).toHaveBeenCalledWith(fileDist1, fs.constants.F_OK);
      expect(fsp.access).toHaveBeenCalledWith(fileDist2, fs.constants.F_OK);
    });
  });
});
