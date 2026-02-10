// @vitest-environment node
import { describe, test, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { FreezeTransaction, FreezeType, Transaction, TransferTransaction } from '@hashgraph/sdk';
import {
  getFreezeTypeString,
  getDisplayTransactionType,
  formatTransactionType,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import * as organizationService from '@renderer/services/organization';

vi.mock('@renderer/services/organization', () => ({
  getTransactionById: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  hexToUint8Array: (hexString: string) =>
    new Uint8Array(
      (hexString.startsWith('0x') ? hexString.slice(2) : hexString)
        .match(/.{1,2}/g)
        ?.map(byte => parseInt(byte, 16)) || [],
    ),
}));

describe('SDK Transaction Utilities - Freeze Types', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getFreezeTypeString', () => {
    test('returns "Freeze Only" for FreezeType.FreezeOnly', () => {
      expect(getFreezeTypeString(FreezeType.FreezeOnly)).toBe('Freeze Only');
    });

    test('returns "Prepare Upgrade" for FreezeType.PrepareUpgrade', () => {
      expect(getFreezeTypeString(FreezeType.PrepareUpgrade)).toBe('Prepare Upgrade');
    });

    test('returns "Freeze Upgrade" for FreezeType.FreezeUpgrade', () => {
      expect(getFreezeTypeString(FreezeType.FreezeUpgrade)).toBe('Freeze Upgrade');
    });

    test('returns "Freeze Abort" for FreezeType.FreezeAbort', () => {
      expect(getFreezeTypeString(FreezeType.FreezeAbort)).toBe('Freeze Abort');
    });

    test('returns "Telemetry Upgrade" for FreezeType.TelemetryUpgrade', () => {
      expect(getFreezeTypeString(FreezeType.TelemetryUpgrade)).toBe('Telemetry Upgrade');
    });

    test('returns "Unknown" for invalid freeze type', () => {
      // Cast to FreezeType to test default case
      const invalidType = 99 as unknown as FreezeType;
      expect(getFreezeTypeString(invalidType)).toBe('Unknown');
    });
  });

  describe('formatTransactionType', () => {
    test('returns type as-is when no options provided', () => {
      expect(formatTransactionType('Freeze Transaction')).toBe('Freeze Transaction');
    });

    test('removes " Transaction" suffix when removeTransaction is true', () => {
      expect(formatTransactionType('Freeze Transaction', false, true)).toBe('Freeze');
    });

    test('removes whitespace when short is true', () => {
      expect(formatTransactionType('Freeze Transaction', true, false)).toBe('FreezeTransaction');
    });

    test('removes both whitespace and suffix when both options are true', () => {
      expect(formatTransactionType('Freeze Transaction', true, true)).toBe('Freeze');
    });

    test('does not remove "Transaction" if not at the end', () => {
      expect(formatTransactionType('Transaction Freeze', false, true)).toBe('Transaction Freeze');
    });
  });

  describe('getTransactionType', () => {
    test('returns "Freeze Transaction" for FreezeTransaction', () => {
      const freezeTx = new FreezeTransaction();
      expect(getTransactionType(freezeTx)).toBe('Freeze Transaction');
    });

    test('returns "Transfer Transaction" for TransferTransaction', () => {
      const transferTx = new TransferTransaction();
      expect(getTransactionType(transferTx)).toBe('Transfer Transaction');
    });

    test('returns "Freeze" when removeTransaction is true', () => {
      const freezeTx = new FreezeTransaction();
      expect(getTransactionType(freezeTx, false, true)).toBe('Freeze');
    });

    test('returns "FreezeTransaction" when short is true', () => {
      const freezeTx = new FreezeTransaction();
      expect(getTransactionType(freezeTx, true, false)).toBe('FreezeTransaction');
    });
  });

  describe('getDisplayTransactionType', () => {
    test('returns specific freeze type for FreezeTransaction with FreezeOnly', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.FreezeOnly);
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Freeze Only');
    });

    test('returns specific freeze type for FreezeTransaction with PrepareUpgrade', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.PrepareUpgrade);
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Prepare Upgrade');
    });

    test('returns specific freeze type for FreezeTransaction with FreezeUpgrade', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.FreezeUpgrade);
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Freeze Upgrade');
    });

    test('returns specific freeze type for FreezeTransaction with FreezeAbort', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.FreezeAbort);
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Freeze Abort');
    });

    test('returns specific freeze type for FreezeTransaction with TelemetryUpgrade', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.TelemetryUpgrade);
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Telemetry Upgrade');
    });

    test('falls back to "Freeze" for FreezeTransaction without freezeType set', () => {
      const freezeTx = new FreezeTransaction();
      // FreezeTransaction without setFreezeType should fall back to standard type
      expect(getDisplayTransactionType(freezeTx, false, true)).toBe('Freeze');
    });

    test('returns standard type for non-freeze transactions', () => {
      const transferTx = new TransferTransaction();
      expect(getDisplayTransactionType(transferTx, false, true)).toBe('Transfer');
    });

    test('applies short format when requested', () => {
      const freezeTx = new FreezeTransaction().setFreezeType(FreezeType.FreezeUpgrade);
      expect(getDisplayTransactionType(freezeTx, true, false)).toBe('FreezeUpgrade');
    });

    test('handles Uint8Array input by deserializing', () => {
      // Note: Creating valid transaction bytes requires freezing the transaction,
      // which needs a client connection. We test deserialization error handling instead.
      // The deserialization path is tested via the error handling test below.
      // Here we verify that Transaction.fromBytes is called for Uint8Array input
      // by checking behavior with invalid bytes (which triggers the error path).

      // This test verifies that Uint8Array input triggers the deserialization code path
      // The actual deserialization behavior is integration-tested elsewhere
      const validEmptyTransaction = new Uint8Array([]);
      // Empty bytes should trigger error handling
      const result = getDisplayTransactionType(validEmptyTransaction, false, true);
      expect(result).toBe('Freeze');
    });

    test('handles deserialization errors gracefully', () => {
      const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
      // Should return fallback value for invalid bytes
      const result = getDisplayTransactionType(invalidBytes, false, true);
      expect(result).toBe('Freeze');
    });

    describe('with BackendTypeInput', () => {
      test('returns freeze type string when backendType is FREEZE and freezeType provided', () => {
        const result = getDisplayTransactionType(
          { backendType: 'FREEZE', freezeType: FreezeType.FreezeUpgrade },
          false,
          true,
        );
        expect(result).toBe('Freeze Upgrade');
      });

      test('returns standard type when backendType is FREEZE but freezeType is null', () => {
        const result = getDisplayTransactionType(
          { backendType: 'FREEZE', freezeType: null },
          false,
          true,
        );
        expect(result).toBe('Freeze');
      });

      test('converts backend type to display format for non-freeze types', () => {
        const result = getDisplayTransactionType({ backendType: 'TRANSFER' }, false, true);
        expect(result).toBe('Transfer');
      });

      test('applies short format to backend type', () => {
        const result = getDisplayTransactionType(
          { backendType: 'FREEZE', freezeType: FreezeType.FreezeAbort },
          true,
          false,
        );
        expect(result).toBe('FreezeAbort');
      });
    });

    describe('with LocalTypeInput', () => {
      test('returns formatted local type for non-freeze transactions', () => {
        const result = getDisplayTransactionType(
          { localType: 'Transfer Transaction' },
          false,
          true,
        );
        expect(result).toBe('Transfer');
      });

      test('returns formatted local type when no transactionBytes provided', () => {
        const result = getDisplayTransactionType(
          { localType: 'Freeze Transaction' },
          false,
          true,
        );
        expect(result).toBe('Freeze');
      });

      test('applies short format to local type', () => {
        const result = getDisplayTransactionType(
          { localType: 'Transfer Transaction' },
          true,
          false,
        );
        expect(result).toBe('TransferTransaction');
      });

      test.each([
        ['Freeze Transaction', 'Freeze'],
        ['FreezeTransaction', 'FreezeTransaction'],
        ['Freeze', 'Freeze'],
        ['FREEZE', 'FREEZE'],
      ])(
        'recognizes freeze type variant "%s" for freeze subtype extraction',
        (localType, expected) => {
          // Without transactionBytes, should just format the localType
          // The key behavior is that all these variants are recognized as freeze types
          // and would attempt to extract freeze subtype if transactionBytes were provided
          const result = getDisplayTransactionType({ localType }, false, true);
          expect(result).toBe(expected);
        },
      );

      test('extracts freeze subtype from valid transactionBytes', () => {
        const fromBytesSpy = vi.spyOn(Transaction, 'fromBytes');
        const mockFreezeTx = new FreezeTransaction();
        Object.defineProperty(mockFreezeTx, 'freezeType', { value: FreezeType.FreezeUpgrade });
        fromBytesSpy.mockReturnValueOnce(mockFreezeTx);

        const result = getDisplayTransactionType(
          { localType: 'Freeze Transaction', transactionBytes: '1,2,3' },
          false,
          true,
        );
        expect(result).toBe('Freeze Upgrade');
        fromBytesSpy.mockRestore();
      });

      test('falls back to formatted localType when deserialized freeze tx has no freezeType', () => {
        const fromBytesSpy = vi.spyOn(Transaction, 'fromBytes');
        const mockFreezeTx = new FreezeTransaction();
        Object.defineProperty(mockFreezeTx, 'freezeType', { value: null });
        fromBytesSpy.mockReturnValueOnce(mockFreezeTx);

        const result = getDisplayTransactionType(
          { localType: 'Freeze Transaction', transactionBytes: '1,2,3' },
          false,
          true,
        );
        expect(result).toBe('Freeze');
        fromBytesSpy.mockRestore();
      });

      test('falls back to formatted localType when transactionBytes are invalid', () => {
        const result = getDisplayTransactionType(
          { localType: 'Freeze Transaction', transactionBytes: 'invalid,bytes' },
          false,
          true,
        );
        expect(result).toBe('Freeze');
      });

      test('falls back to formatted localType when bytes deserialize to non-freeze transaction', () => {
        const fromBytesSpy = vi.spyOn(Transaction, 'fromBytes');
        const mockTransferTx = new TransferTransaction();
        fromBytesSpy.mockReturnValueOnce(mockTransferTx);

        const result = getDisplayTransactionType(
          { localType: 'Freeze Transaction', transactionBytes: '1,2,3' },
          false,
          true,
        );
        expect(result).toBe('Freeze');
        fromBytesSpy.mockRestore();
      });
    });
  });
});

describe('getFreezeTypeForTransaction', () => {
  const serverUrl = 'http://localhost:8080';
  const transactionId = 123;

  // Helper to create mock freeze transaction with specific freeze type
  const createMockFreezeTransaction = (freezeType: FreezeType) => {
    const mockTx = {
      freezeType,
    };
    // Make it pass instanceof check
    Object.setPrototypeOf(mockTx, FreezeTransaction.prototype);
    return mockTx;
  };

  // Helper to create mock non-freeze transaction
  const createMockTransferTransaction = () => {
    const mockTx = {};
    Object.setPrototypeOf(mockTx, TransferTransaction.prototype);
    return mockTx;
  };

  // Convert string to hex for mock response
  const stringToHex = (str: string) =>
    Array.from(str)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');

  let getFreezeTypeForTransaction: typeof import('@renderer/utils/sdk/transactions').getFreezeTypeForTransaction;
  let fromBytesSpy: MockInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Reset modules to clear the module-level cache
    vi.resetModules();

    // Re-import to get fresh module with empty cache
    const module = await import('@renderer/utils/sdk/transactions');
    getFreezeTypeForTransaction = module.getFreezeTypeForTransaction;

    // Spy on Transaction.fromBytes
    fromBytesSpy = vi.spyOn(Transaction, 'fromBytes');
  });

  describe('API fetching', () => {
    test('fetches and returns freeze type for freeze transaction', async () => {
      const mockFreezeTransaction = createMockFreezeTransaction(FreezeType.FreezeUpgrade);

      vi.mocked(organizationService.getTransactionById).mockResolvedValueOnce({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValueOnce(mockFreezeTransaction as any);

      const result = await getFreezeTypeForTransaction(serverUrl, transactionId);

      expect(organizationService.getTransactionById).toHaveBeenCalledWith(serverUrl, transactionId);
      expect(result).toBe(FreezeType.FreezeUpgrade);
    });

    test('returns null for non-freeze transactions', async () => {
      const mockTransferTransaction = createMockTransferTransaction();

      vi.mocked(organizationService.getTransactionById).mockResolvedValueOnce({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValueOnce(mockTransferTransaction as any);

      const result = await getFreezeTypeForTransaction(serverUrl, transactionId);

      expect(result).toBeNull();
    });

    test('returns null and logs error when API fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(organizationService.getTransactionById).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await getFreezeTypeForTransaction(serverUrl, transactionId);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch freeze type:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    test('returns null for freeze transaction without freezeType set', async () => {
      const mockFreezeTransaction = {
        freezeType: null,
      };
      Object.setPrototypeOf(mockFreezeTransaction, FreezeTransaction.prototype);

      vi.mocked(organizationService.getTransactionById).mockResolvedValueOnce({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValueOnce(mockFreezeTransaction as any);

      const result = await getFreezeTypeForTransaction(serverUrl, transactionId);

      expect(result).toBeNull();
    });
  });

  describe('caching', () => {
    test('returns cached result on second call with same params', async () => {
      const mockFreezeTransaction = createMockFreezeTransaction(FreezeType.PrepareUpgrade);

      vi.mocked(organizationService.getTransactionById).mockResolvedValueOnce({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValueOnce(mockFreezeTransaction as any);

      // First call - should fetch from API
      const result1 = await getFreezeTypeForTransaction(serverUrl, transactionId);
      expect(result1).toBe(FreezeType.PrepareUpgrade);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getFreezeTypeForTransaction(serverUrl, transactionId);
      expect(result2).toBe(FreezeType.PrepareUpgrade);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1); // Still 1
    });

    test('fetches separately for different serverUrls with same transactionId', async () => {
      const serverUrl1 = 'http://server1.com';
      const serverUrl2 = 'http://server2.com';

      const mockFreezeTransaction1 = createMockFreezeTransaction(FreezeType.FreezeOnly);
      const mockFreezeTransaction2 = createMockFreezeTransaction(FreezeType.FreezeUpgrade);

      vi.mocked(organizationService.getTransactionById)
        .mockResolvedValueOnce({ transactionBytes: stringToHex('mock-bytes-1') } as any)
        .mockResolvedValueOnce({ transactionBytes: stringToHex('mock-bytes-2') } as any);
      fromBytesSpy
        .mockReturnValueOnce(mockFreezeTransaction1 as any)
        .mockReturnValueOnce(mockFreezeTransaction2 as any);

      // Call with first serverUrl
      const result1 = await getFreezeTypeForTransaction(serverUrl1, transactionId);
      expect(result1).toBe(FreezeType.FreezeOnly);

      // Call with second serverUrl (same transactionId) - should NOT use cache
      const result2 = await getFreezeTypeForTransaction(serverUrl2, transactionId);
      expect(result2).toBe(FreezeType.FreezeUpgrade);

      // API should have been called twice (once per serverUrl)
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(2);
      expect(organizationService.getTransactionById).toHaveBeenCalledWith(serverUrl1, transactionId);
      expect(organizationService.getTransactionById).toHaveBeenCalledWith(serverUrl2, transactionId);
    });

    test('caches null results for non-freeze transactions', async () => {
      const mockTransferTransaction = createMockTransferTransaction();

      vi.mocked(organizationService.getTransactionById).mockResolvedValueOnce({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValueOnce(mockTransferTransaction as any);

      // First call - returns null
      const result1 = await getFreezeTypeForTransaction(serverUrl, transactionId);
      expect(result1).toBeNull();
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1);

      // Second call - should use cached null
      const result2 = await getFreezeTypeForTransaction(serverUrl, transactionId);
      expect(result2).toBeNull();
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('LRU eviction', () => {
    test('evicts oldest entry when cache exceeds 250 entries', async () => {
      const mockFreezeTransaction = createMockFreezeTransaction(FreezeType.FreezeOnly);

      // Mock to always return a freeze transaction
      vi.mocked(organizationService.getTransactionById).mockResolvedValue({
        transactionBytes: stringToHex('mock-bytes'),
      } as any);
      fromBytesSpy.mockReturnValue(mockFreezeTransaction as any);

      // Fill cache with 250 entries
      for (let i = 0; i < 250; i++) {
        await getFreezeTypeForTransaction(serverUrl, i);
      }

      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(250);

      // Access entry 0 again - should be cached
      vi.mocked(organizationService.getTransactionById).mockClear();
      await getFreezeTypeForTransaction(serverUrl, 0);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(0);

      // Add entry 250 - this should evict the oldest (entry 1, since 0 was just accessed)
      await getFreezeTypeForTransaction(serverUrl, 250);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1);

      // Entry 1 should have been evicted - accessing it should trigger API call
      vi.mocked(organizationService.getTransactionById).mockClear();
      await getFreezeTypeForTransaction(serverUrl, 1);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(1);

      // Entry 0 should still be cached (was accessed recently)
      vi.mocked(organizationService.getTransactionById).mockClear();
      await getFreezeTypeForTransaction(serverUrl, 0);
      expect(organizationService.getTransactionById).toHaveBeenCalledTimes(0);
    });
  });
});
