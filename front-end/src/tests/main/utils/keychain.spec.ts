import { beforeEach, describe, expect, test, vi } from 'vitest';

import { safeStorage } from 'electron';

import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import { getUseKeychainClaim } from '@main/services/localUser/claim';

import {
  KeychainUnavailableError,
  keychainDecrypt,
  keychainEncrypt,
  probeKeychain,
} from '@main/utils/keychain';

vi.mock('electron', () => ({
  safeStorage: { encryptString: vi.fn(), decryptString: vi.fn() },
}));
const mockLogger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));
vi.mock('@main/modules/logger', () => ({ createLogger: () => mockLogger }));
vi.mock('@main/services/localUser/claim', () => ({ getUseKeychainClaim: vi.fn() }));

describe('keychain utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('keychainDecrypt / keychainEncrypt', () => {
    test('passes results through on success', () => {
      vi.mocked(safeStorage.decryptString).mockReturnValue('plain');
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('cipher'));

      expect(keychainDecrypt(Buffer.from('x'))).toBe('plain');
      expect(keychainEncrypt('plain')).toEqual(Buffer.from('cipher'));
    });

    test('wraps decrypt failures in KeychainUnavailableError keeping the cause', () => {
      const underlying = new Error('Encryption is not available');
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw underlying;
      });

      let err: KeychainUnavailableError | undefined;
      try {
        keychainDecrypt(Buffer.from('x'));
      } catch (e) {
        err = e as KeychainUnavailableError;
      }

      expect(err).toBeInstanceOf(KeychainUnavailableError);
      expect(err?.message).toBe(KEYCHAIN_UNAVAILABLE_MESSAGE);
      expect(err?.cause).toBe(underlying);
    });

    test('wraps encrypt failures in KeychainUnavailableError', () => {
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw new Error('denied');
      });

      expect(() => keychainEncrypt('x')).toThrow(KeychainUnavailableError);
    });

    test('logs the underlying error on decrypt and encrypt failures', () => {
      const underlying = new Error('denied');
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw underlying;
      });
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw underlying;
      });

      expect(() => keychainDecrypt(Buffer.from('x'))).toThrow();
      expect(() => keychainEncrypt('x')).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Keychain decrypt failed', {
        error: underlying,
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Keychain encrypt failed', {
        error: underlying,
      });
    });
  });

  describe('KeychainUnavailableError', () => {
    test('stringifies as a plain Error so the renderer can parse it after crossing IPC', () => {
      expect(String(new KeychainUnavailableError())).toBe(`Error: ${KEYCHAIN_UNAVAILABLE_MESSAGE}`);
    });
  });

  describe('probeKeychain', () => {
    test('returns true when the canary round trips', () => {
      vi.mocked(safeStorage.encryptString).mockImplementation(s => Buffer.from(s));
      vi.mocked(safeStorage.decryptString).mockImplementation(b => b.toString());
      expect(probeKeychain()).toBe(true);
    });

    test('returns false when encrypt fails', () => {
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw new Error('denied');
      });
      expect(probeKeychain()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Keychain probe failed', {
        error: expect.any(Error),
      });
    });

    test('returns false when decrypt fails', () => {
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('a'));
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error('locked');
      });
      expect(probeKeychain()).toBe(false);
    });

    test('returns false when the canary does not round trip', () => {
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('a'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('different');
      expect(probeKeychain()).toBe(false);
    });
  });

  describe('startup probe', () => {
    const load = async () => {
      vi.resetModules();
      return await import('@main/utils/keychain');
    };

    const roundTrip = () => {
      vi.mocked(safeStorage.encryptString).mockImplementation(s => Buffer.from(s));
      vi.mocked(safeStorage.decryptString).mockImplementation(b => b.toString());
    };

    test('probes once in keychain mode and serves the stored result afterwards', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(true);
      roundTrip();
      const { probeKeychainAtStartup, getKeychainStatus } = await load();

      await probeKeychainAtStartup();
      vi.mocked(safeStorage.encryptString).mockClear();

      expect(getKeychainStatus()).toBe(true);
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
    });

    test('stores a failed startup probe', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(true);
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw new Error('denied');
      });
      const { probeKeychainAtStartup, getKeychainStatus } = await load();

      await probeKeychainAtStartup();
      roundTrip(); // would pass now, but the stored result wins

      expect(getKeychainStatus()).toBe(false);
    });

    test('does not touch the keychain when not in keychain mode', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);
      const { probeKeychainAtStartup } = await load();

      await probeKeychainAtStartup();

      expect(safeStorage.encryptString).not.toHaveBeenCalled();
    });

    test('does not touch the keychain when the mode is not initialized', async () => {
      vi.mocked(getUseKeychainClaim).mockRejectedValue(new Error('Keychain mode not initialized'));
      const { probeKeychainAtStartup } = await load();

      await probeKeychainAtStartup();

      expect(safeStorage.encryptString).not.toHaveBeenCalled();
    });

    test('getKeychainStatus falls back to a live probe when no startup probe ran', async () => {
      roundTrip();
      const { getKeychainStatus } = await load();

      expect(getKeychainStatus()).toBe(true);
      expect(safeStorage.encryptString).toHaveBeenCalled();
    });
  });
});
