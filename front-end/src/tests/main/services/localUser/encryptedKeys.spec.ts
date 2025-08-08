import { expect, vi } from 'vitest';
import * as fsp from 'fs/promises';
import * as path from 'path';
import EventEmitter from 'events';
import { app } from 'electron';
import * as forge from 'node-forge';

import {
  getFileStreamEventEmitter,
  searchEncryptedKeysAbort,
  Abortable,
  EncryptedKeysSearcher,
  decryptPrivateKeyFromPath,
  decryptPrivateKeyFromPem,
  getRecoveryPhraseInfo,
} from '@main/services/localUser/encryptedKeys';
import { ENCRYPTED_KEY_ALREADY_IMPORTED } from '@shared/constants';
import { copyFile, getUniquePath, unzip } from '@main/utils/files';
import { Stats } from 'fs';

vi.mock('fs/promises');
vi.mock('path');
vi.mock('electron', () => ({ app: { getPath: vi.fn() } }));
vi.mock('node-forge', () => ({
  pki: {
    encryptedPrivateKeyFromPem: vi.fn(),
    decryptPrivateKeyInfo: vi.fn(),
  },
  asn1: { toDer: vi.fn() },
}));
vi.mock('@main/utils/files');

describe('Encrypted Keys Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getFileStreamEventEmitter', () => {
    test('Should return a singleton EventEmitter instance', () => {
      const emitter1 = getFileStreamEventEmitter();
      const emitter2 = getFileStreamEventEmitter();

      expect(emitter1).toBe(emitter2);
      expect(emitter1).toBeInstanceOf(EventEmitter);
    });
  });

  describe('Abortable', () => {
    test('Should set aborted state to true on abort event', () => {
      const abortable = new Abortable(searchEncryptedKeysAbort);

      expect(abortable.state.aborted).toBe(false);

      getFileStreamEventEmitter().emit(searchEncryptedKeysAbort);

      expect(abortable.state.aborted).toBe(true);
    });
  });

  describe('EncryptedKeysSearcher', () => {
    let searcher: EncryptedKeysSearcher;
    let abortable: Abortable;

    beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

      abortable = new Abortable(searchEncryptedKeysAbort);
      searcher = new EncryptedKeysSearcher(abortable, ['.pem']);
    });

    test('Should create search directory', async () => {
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);
      await searcher.search([]);

      expect(fsp.mkdir).toHaveBeenCalledWith(expect.stringContaining(tempDir), { recursive: true });
    });

    test('Should search encrypted files in given paths', async () => {
      const filePaths = ['/path/to/dir', '/path/to/file1.pem', '/path/to/file2.zip'];
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[0]);
      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[1]);
      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(filePaths[2]);
    });

    test('Should search encrypted files in given dir path', async () => {
      const filePaths = ['/path/to/dir'];
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as Stats);
      vi.spyOn(searcher, '_searchFromDir' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromDir']).toHaveBeenCalledWith(filePaths[0]);
    });

    test('Should search encrypted files in given zip path', async () => {
      const filePaths = ['/path/to/file.zip'];
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as Stats);
      vi.mocked(path.extname).mockReturnValue('.zip');
      vi.spyOn(searcher, '_searchFromZip' as any).mockImplementation(vi.fn());

      await searcher.search(filePaths);

      expect(searcher['_searchFromZip']).toHaveBeenCalledWith(filePaths[0]);
    });

    test('Should catch error if search fails', async () => {
      const filePaths = ['/path/to/file.zip'];
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as Stats);
      vi.mocked(path.extname).mockReturnValue('.zip');
      vi.spyOn(searcher, '_searchFromZip' as any).mockImplementation(() => {
        throw new Error('Search failed');
      });

      await searcher.search(filePaths);
    });

    test('Should catch error if search dir fails', async () => {
      const tempDir = '/temp';

      vi.mocked(app.getPath).mockReturnValue(tempDir);
      vi.mocked(fsp.readdir).mockResolvedValue(['file1.pem', 'file2.zip'] as any);
      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(() => {
        throw new Error('Search failed');
      });

      await searcher['_searchFromDir']('/path/to/dir');
    });

    test("Should abort search if it's already aborted", async () => {
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(vi.fn());
      vi.spyOn(searcher, '_searchFromDir' as any).mockImplementation(vi.fn());
      vi.spyOn(searcher, '_searchFromZip' as any).mockImplementation(vi.fn());

      abortable.abort();

      await searcher.search(['file1.pem', 'file2.zip', '/path/to/dir']);

      expect(searcher['_searchFromPath']).not.toHaveBeenCalled();
      expect(searcher['_searchFromDir']).not.toHaveBeenCalled();
      expect(searcher['_searchFromZip']).not.toHaveBeenCalled();
    });

    test("Should abort _searchFromDir if it's already aborted", async () => {
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.mocked(fsp.readdir).mockResolvedValue(['file1.pem', 'file2.zip'] as any);
      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(vi.fn());

      abortable.abort();

      await searcher['_searchFromDir']('/path/to/dir');

      expect(searcher['_searchFromPath']).not.toHaveBeenCalled();
    });

    test('Should delete search directories on abort', async () => {
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_createSearchDir' as any).mockImplementation(vi.fn());
      vi.spyOn(searcher, 'deleteSearchDirs' as any).mockImplementation(vi.fn());

      abortable.abort();

      await searcher.search([]);

      expect(searcher.deleteSearchDirs).toHaveBeenCalled();
    });

    test('Should handle directory search', async () => {
      const dirPath = '/path/to/dir';
      const fileNames = ['file1.pem', 'file2.zip'];
      vi.mocked(fsp.readdir).mockResolvedValue(fileNames as any);

      vi.spyOn(searcher, '_searchFromPath' as any).mockImplementation(vi.fn());

      await searcher['_searchFromDir'](dirPath);

      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(path.join(dirPath, fileNames[0]));
      expect(searcher['_searchFromPath']).toHaveBeenCalledWith(path.join(dirPath, fileNames[1]));
    });

    test('Should handle zip file search', async () => {
      const zipPath = '/path/to/file.zip';
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.spyOn(searcher, '_searchFromDir' as any).mockImplementation(vi.fn());

      await searcher['_searchFromZip'](zipPath);

      expect(unzip).toHaveBeenCalledWith(
        zipPath,
        expect.stringContaining(tempDir),
        ['.pem'],
        abortable.state,
      );
      expect(searcher['_searchFromDir']).toHaveBeenCalled();
    });

    test('Should handle encrypted file search', async () => {
      const filePath = '/path/to/file.pem';
      const tempDir = '/temp';
      vi.mocked(app.getPath).mockReturnValue(tempDir);

      vi.mocked(fsp.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as Stats);
      vi.mocked(path.extname).mockReturnValue('.pem');
      vi.mocked(getUniquePath).mockResolvedValue('/unique/path/to/file.pem');

      await searcher['_searchFromPath'](filePath);

      expect(copyFile).toHaveBeenCalledWith(filePath, '/unique/path/to/file.pem', abortable.state);
    });

    test('Should delete all directories successfully', async () => {
      const searchDir = '/path/to/searchDir';
      const unzipDirs = ['/path/to/unzipDir1', '/path/to/unzipDir2'];
      searcher.searchDir = searchDir;
      searcher.unzipDirs = unzipDirs;

      vi.mocked(fsp.rm).mockResolvedValue(undefined);

      await searcher.deleteSearchDirs();

      expect(fsp.rm).toHaveBeenCalledWith(searchDir, { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[0], { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[1], { recursive: true });
    });

    test('Should log errors if directories fail to delete', async () => {
      const searchDir = '/path/to/searchDir';
      const unzipDirs = ['/path/to/unzipDir1', '/path/to/unzipDir2'];
      searcher.searchDir = searchDir;
      searcher.unzipDirs = unzipDirs;

      const error = new Error('Failed to delete');
      vi.mocked(fsp.rm).mockImplementation(dir => {
        if (dir === unzipDirs[0]) {
          return Promise.reject(error);
        }
        return Promise.resolve();
      });

      const consoleSpy = vi.spyOn(console, 'log');

      await searcher.deleteSearchDirs();

      expect(fsp.rm).toHaveBeenCalledWith(searchDir, { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[0], { recursive: true });
      expect(fsp.rm).toHaveBeenCalledWith(unzipDirs[1], { recursive: true });

      expect(consoleSpy).toHaveBeenCalledWith('Delete search dirs error:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('decryptPrivateKeyFromPath', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should decrypt private key from file path', async () => {
      const filePath = '/path/to/file.pem';
      const password = 'password';
      const fileContent = `
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;
      const privateKey = 'private key';

      vi.mocked(fsp.readFile).mockResolvedValue(fileContent);

      vi.mocked(forge.pki.encryptedPrivateKeyFromPem).mockReturnValue('some-info' as any);
      vi.mocked(forge.pki.decryptPrivateKeyInfo).mockReturnValue('some-key' as any);
      vi.mocked(forge.asn1.toDer).mockReturnValue({ toHex: () => privateKey } as any);

      const result = await decryptPrivateKeyFromPath(filePath, password, null, null);

      expect(result).toEqual({ privateKey, recoveryPhraseHashCode: null, index: null });
    });

    test("Should decrypt private key and return recovery phrase info if it's provided", async () => {
      const filePath = '/path/to/file.pem';
      const password = 'password';
      const fileContent = `
      Index: 1
      Recovery Phrase Hash: 123
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;
      const privateKey = 'private key';

      vi.mocked(fsp.readFile).mockResolvedValue(fileContent);

      vi.mocked(forge.pki.encryptedPrivateKeyFromPem).mockReturnValue('some-info' as any);
      vi.mocked(forge.pki.decryptPrivateKeyInfo).mockReturnValue('some-key' as any);
      vi.mocked(forge.asn1.toDer).mockReturnValue({ toHex: () => privateKey } as any);

      const result = await decryptPrivateKeyFromPath(filePath, password, null, null);

      expect(result).toEqual({ privateKey, recoveryPhraseHashCode: 123, index: 1 });
    });

    test('Should throw error if key already imported', async () => {
      const filePath = '/path/to/file.pem';
      const password = 'password';
      const pem = `
      Index: 1
      Recovery Phrase Hash: 123
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;

      vi.mocked(fsp.readFile).mockResolvedValue(pem);

      await expect(decryptPrivateKeyFromPath(filePath, password, [1], 123)).rejects.toThrow(
        ENCRYPTED_KEY_ALREADY_IMPORTED,
      );
    });

    test('Should throw error if decryption fails', async () => {
      const filePath = '/path/to/file.pem';
      const password = 'password';
      const fileContent = 'file content';

      vi.mocked(fsp.readFile).mockResolvedValue(fileContent);
      vi.mocked(forge.pki.encryptedPrivateKeyFromPem).mockImplementationOnce(() => {
        throw new Error();
      });

      await expect(decryptPrivateKeyFromPath(filePath, password, null, null)).rejects.toThrow(
        'Incorrect encryption password',
      );
    });
  });

  describe('decryptPrivateKeyFromPem', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should decrypt private key from PEM', () => {
      const pem = 'pem content';
      const password = 'password';
      const privateKey = 'hex';

      vi.mocked(forge.pki.encryptedPrivateKeyFromPem).mockReturnValue('some-info' as any);
      vi.mocked(forge.pki.decryptPrivateKeyInfo).mockReturnValue('some-key' as any);
      vi.mocked(forge.asn1.toDer).mockReturnValue({ toHex: () => privateKey } as any);

      const result = decryptPrivateKeyFromPem(pem, password);

      expect(result).toBe('hex');
    });

    test('Should throw if no private key info found', () => {
      const pem = 'pem content';
      const password = 'password';

      vi.mocked(forge.pki.encryptedPrivateKeyFromPem).mockReturnValue('some-info' as any);
      vi.mocked(forge.pki.decryptPrivateKeyInfo).mockReturnValue(null as any);

      expect(() => decryptPrivateKeyFromPem(pem, password)).toThrow(
        'Incorrect encryption password',
      );
    });
  });

  describe('getRecoveryPhraseInfo', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return recovery phrase info from PEM', () => {
      const pem = `
      Index: 1
      Recovery Phrase Hash: 123
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;

      const result = getRecoveryPhraseInfo(pem);

      expect(result).toEqual({ hashCode: 123, index: 1 });
    });

    test('Should return null if recovery phrase info not found', () => {
      const pem = `
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;

      const result = getRecoveryPhraseInfo(pem);

      expect(result).toBeNull();
    });

    test('Should return null if recovery phrase info not full', () => {
      const pem = `
        Index: 1
        -----BEGIN ENCRYPTED PRIVATE KEY-----
        -----END ENCRYPTED PRIVATE KEY-----
      `;

      const result = getRecoveryPhraseInfo(pem);

      expect(result).toBeNull();
    });
  });
});
