import { describe, expect, vi } from 'vitest';
import * as fsp from 'fs/promises';
import * as forge from 'node-forge';

import {
  abortEncryptedKeySearch,
  decryptPrivateKeyFromPath,
  decryptPrivateKeyFromPem,
  getRecoveryPhraseInfo,
  searchEncryptedKeys,
} from '@main/services/localUser/encryptedKeys';
import { ENCRYPTED_KEY_ALREADY_IMPORTED } from '@shared/constants';

import { searchFiles, abortFileSearch } from '@main/utils/files';

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

  describe('searchEncryptedKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('calls searchFiles with correct arguments', async () => {
      vi.mocked(searchFiles).mockImplementation(async (filePaths, extensions, processFile) => {
        // Simulate calling processFile for each filePath
        const results: any[] = [];
        for (const filePath of filePaths) {
          const res = [await processFile(filePath)];
          results.push(...res);
        }
        return results;
      });

      const inputPaths = ['/file1.pem', '/file2.pem'];
      const result = await searchEncryptedKeys(inputPaths);

      expect(searchFiles).toHaveBeenCalledWith(
        inputPaths,
        ['.pem'],
        expect.any(Function),
      );
      // In this case, processFile just returns the filePath, so result should equal inputPaths
      expect(result).toEqual(inputPaths);
    });

    test('returns empty array if searchFiles returns empty', async () => {
      vi.mocked(searchFiles).mockResolvedValue([]);

      const result = await searchEncryptedKeys(['/c.pem']);
      expect(result).toEqual([]);
    });

    test('handles empty input', async () => {
      vi.mocked(searchFiles).mockResolvedValue([]);
      const result = await searchEncryptedKeys([]);
      expect(result).toEqual([]);
    });
  });

  describe('abortEncryptedKeySearch', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should call abortFileSearch', () => {
      abortEncryptedKeySearch();
      expect(abortFileSearch).toHaveBeenCalled();
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
