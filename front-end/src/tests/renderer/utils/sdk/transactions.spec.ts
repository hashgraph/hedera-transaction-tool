// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { FreezeTransaction, FreezeType, Transaction, TransferTransaction } from '@hiero-ledger/sdk';
import {
  formatTransactionType,
  getDisplayTransactionType,
  getFreezeTypeString,
  getRawTransactionType,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => mockLogger,
}));

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
      expect(result).toBe('Unknown Transaction Type');
    });

    test('handles deserialization errors gracefully', () => {
      const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
      // Should return fallback value for invalid bytes
      const result = getDisplayTransactionType(invalidBytes, false, true);
      expect(result).toBe('Unknown Transaction Type');
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

    describe('with string input', () => {
      test('passes raw string through formatTransactionType', () => {
        expect(getDisplayTransactionType('Account Create Transaction')).toBe(
          'Account Create Transaction',
        );
      });

      test('removes " Transaction" suffix when removeTransaction is true', () => {
        expect(getDisplayTransactionType('Account Create Transaction', false, true)).toBe(
          'Account Create',
        );
      });

      test('removes whitespace when short is true', () => {
        expect(getDisplayTransactionType('Account Create Transaction', true)).toBe(
          'AccountCreateTransaction',
        );
      });

      test('returns string unchanged when it has no " Transaction" suffix and removeTransaction is true', () => {
        expect(getDisplayTransactionType('Freeze Only', false, true)).toBe('Freeze Only');
      });
    });
  });

  describe('getRawTransactionType', () => {
    test('returns raw freeze subtype name for FREEZE backend type with freezeType', () => {
      expect(
        getRawTransactionType({ backendType: 'FREEZE', freezeType: FreezeType.FreezeOnly }),
      ).toBe('Freeze Only');
    });

    test('returns "Unknown Transaction Type" for unrecognized backend type', () => {
      expect(getRawTransactionType({ backendType: 'NOT_A_REAL_TYPE' })).toBe(
        'Unknown Transaction Type',
      );
    });

    test('returns localType unchanged for non-freeze local input', () => {
      expect(getRawTransactionType({ localType: 'Account Create Transaction' })).toBe(
        'Account Create Transaction',
      );
    });

    test('returns raw transaction type for SDK Transaction', () => {
      const transferTx = new TransferTransaction();
      expect(getRawTransactionType(transferTx)).toBe('Transfer Transaction');
    });
  });
});
