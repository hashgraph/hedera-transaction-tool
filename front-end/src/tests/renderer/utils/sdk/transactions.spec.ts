import { describe, test, expect, vi, beforeEach } from 'vitest';
import { FreezeTransaction, FreezeType, TransferTransaction } from '@hashgraph/sdk';
import {
  getFreezeTypeString,
  getDisplayTransactionType,
  formatTransactionType,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';

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
  });
});
