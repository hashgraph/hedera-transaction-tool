import { describe, expect, test } from 'vitest';

import {
  formatNetwork,
  formatRole,
  formatTransactionType,
} from '@renderer/pages/ReviewerGroups/components/ruleFormatting';

describe('formatRole', () => {
  test('returns "Any" when no role is set', () => {
    expect(formatRole(null)).toBe('Any');
    expect(formatRole(undefined)).toBe('Any');
  });

  test('capitalizes a single-word role', () => {
    expect(formatRole('sender')).toBe('Sender');
  });

  test('capitalizes a multi-word role', () => {
    expect(formatRole('fee_payer')).toBe('Fee payer');
  });
});

describe('formatTransactionType', () => {
  test('returns "Any" when no transaction type is set', () => {
    expect(formatTransactionType(null)).toBe('Any');
    expect(formatTransactionType(undefined)).toBe('Any');
  });

  test('maps a known transaction type to its label', () => {
    expect(formatTransactionType('TRANSFER')).toBe('Transfer Transaction');
  });

  test('falls back to the raw string for an unrecognized transaction type', () => {
    expect(formatTransactionType('SOMETHINGNEW')).toBe('SOMETHINGNEW');
  });
});

describe('formatNetwork', () => {
  test('maps a known network to its label', () => {
    expect(formatNetwork('mainnet')).toBe('Mainnet');
  });

  test('falls back to the raw string for an unrecognized network', () => {
    expect(formatNetwork('some-custom-network')).toBe('some-custom-network');
  });
});
