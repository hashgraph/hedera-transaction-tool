// @vitest-environment node
import { describe, test, expect } from 'vitest';
import {
  AccountId,
  FileUpdateTransaction,
  FileId,
  TransactionId,
  Timestamp,
} from '@hiero-ledger/sdk';

import {
  isPrivilegedFeePayer,
  getMaxTransactionSize,
  getMaxTransactionSizeForTransaction,
} from '@renderer/utils/sdk/privilegedPayer';
import {
  TRANSACTION_MAX_SIZE,
  TRANSACTION_MAX_PRIVILEGED_SIZE,
} from '@shared/constants';

describe('HIP-1300 frontend privileged fee payer detection', () => {
  describe('isPrivilegedFeePayer', () => {
    test('returns false for null and undefined', () => {
      expect(isPrivilegedFeePayer(null)).toBe(false);
      expect(isPrivilegedFeePayer(undefined)).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isPrivilegedFeePayer('')).toBe(false);
    });

    test('returns false for invalid string format', () => {
      expect(isPrivilegedFeePayer('not-an-account-id')).toBe(false);
      expect(isPrivilegedFeePayer('0.0')).toBe(false);
      expect(isPrivilegedFeePayer('abc.def.ghi')).toBe(false);
    });

    test('accepts AccountId instances', () => {
      expect(isPrivilegedFeePayer(AccountId.fromString('0.0.2'))).toBe(true);
      expect(isPrivilegedFeePayer(AccountId.fromString('0.0.500'))).toBe(true);
      expect(isPrivilegedFeePayer(AccountId.fromString('0.0.1000'))).toBe(false);
    });

    test('accepts string account IDs', () => {
      expect(isPrivilegedFeePayer('0.0.2')).toBe(true);
      expect(isPrivilegedFeePayer('0.0.42')).toBe(true);
      expect(isPrivilegedFeePayer('0.0.799')).toBe(true);
      expect(isPrivilegedFeePayer('0.0.800')).toBe(false);
    });

    test.each([
      // Treasury
      ['0.0.2', true],
      // Just above treasury, in the gap that is excluded by HIP-1300
      ['0.0.3', false],
      ['0.0.4', false],
      ['0.0.10', false],
      ['0.0.20', false],
      ['0.0.30', false],
      ['0.0.40', false],
      ['0.0.41', false],
      // Lower boundary of privileged range
      ['0.0.42', true],
      ['0.0.43', true],
      ['0.0.50', true],
      ['0.0.55', true],
      ['0.0.100', true],
      ['0.0.500', true],
      ['0.0.798', true],
      ['0.0.799', true],
      // Just above upper bound
      ['0.0.800', false],
      ['0.0.801', false],
      ['0.0.1000', false],
      ['0.0.10000', false],
      // Account 0 and 1 (excluded)
      ['0.0.0', false],
      ['0.0.1', false],
    ])('account %s is privileged: %s', (id, expected) => {
      expect(isPrivilegedFeePayer(id)).toBe(expected);
    });

    test('rejects non-zero shard even when num matches privileged range', () => {
      expect(isPrivilegedFeePayer(new AccountId(1, 0, 2))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(1, 0, 500))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(2, 0, 42))).toBe(false);
    });

    test('rejects non-zero realm even when num matches privileged range', () => {
      expect(isPrivilegedFeePayer(new AccountId(0, 1, 2))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(0, 1, 500))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(0, 5, 799))).toBe(false);
    });

    test('rejects non-zero shard AND realm together', () => {
      expect(isPrivilegedFeePayer(new AccountId(1, 1, 42))).toBe(false);
    });
  });

  describe('getMaxTransactionSize', () => {
    test('returns standard 6 KB for normal payers', () => {
      expect(getMaxTransactionSize('0.0.1001')).toBe(TRANSACTION_MAX_SIZE);
      expect(getMaxTransactionSize('0.0.99999')).toBe(TRANSACTION_MAX_SIZE);
      expect(getMaxTransactionSize(AccountId.fromString('0.0.41'))).toBe(TRANSACTION_MAX_SIZE);
    });

    test('returns privileged 128 KB for treasury and governance accounts', () => {
      expect(getMaxTransactionSize('0.0.2')).toBe(TRANSACTION_MAX_PRIVILEGED_SIZE);
      expect(getMaxTransactionSize('0.0.42')).toBe(TRANSACTION_MAX_PRIVILEGED_SIZE);
      expect(getMaxTransactionSize('0.0.500')).toBe(TRANSACTION_MAX_PRIVILEGED_SIZE);
      expect(getMaxTransactionSize('0.0.799')).toBe(TRANSACTION_MAX_PRIVILEGED_SIZE);
    });

    test('returns standard size for null/undefined fee payer (defensive default)', () => {
      expect(getMaxTransactionSize(null)).toBe(TRANSACTION_MAX_SIZE);
      expect(getMaxTransactionSize(undefined)).toBe(TRANSACTION_MAX_SIZE);
    });

    test('returns standard size for invalid account string', () => {
      expect(getMaxTransactionSize('garbage')).toBe(TRANSACTION_MAX_SIZE);
    });

    test('returns the exact byte value for privileged limit (128 * 1024)', () => {
      expect(getMaxTransactionSize('0.0.2')).toBe(131072);
    });

    test('returns the exact byte value for standard limit (6 * 1024)', () => {
      expect(getMaxTransactionSize('0.0.10000')).toBe(6144);
    });
  });

  describe('getMaxTransactionSizeForTransaction', () => {
    const buildTx = (payer: string) => {
      const validStart = Timestamp.fromDate(new Date());
      return new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(payer), validStart),
        );
    };

    test('returns 128 KB when fee payer is treasury', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.2'))).toBe(
        TRANSACTION_MAX_PRIVILEGED_SIZE,
      );
    });

    test('returns 128 KB when fee payer is at lower bound of range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.42'))).toBe(
        TRANSACTION_MAX_PRIVILEGED_SIZE,
      );
    });

    test('returns 128 KB when fee payer is at upper bound of range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.799'))).toBe(
        TRANSACTION_MAX_PRIVILEGED_SIZE,
      );
    });

    test('returns 6 KB when fee payer is one below the range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.41'))).toBe(
        TRANSACTION_MAX_SIZE,
      );
    });

    test('returns 6 KB when fee payer is one above the range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.800'))).toBe(
        TRANSACTION_MAX_SIZE,
      );
    });

    test('returns 6 KB when fee payer is a typical user account', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.8261259'))).toBe(
        TRANSACTION_MAX_SIZE,
      );
    });

    test('returns 6 KB defensively when transaction has no transactionId yet', () => {
      const tx = new FileUpdateTransaction().setFileId(FileId.fromString('0.0.150'));
      // No transactionId set — should still return a sane default (standard limit).
      expect(getMaxTransactionSizeForTransaction(tx)).toBe(TRANSACTION_MAX_SIZE);
    });
  });
});
