import { describe, expect, test } from 'vitest';

import {
  describeRule,
  formatNetwork,
  formatRole,
  formatTransactionType,
} from '@renderer/components/ReviewerGroups/ruleDescription';

describe('describeRule', () => {
  test('describes a rule with no role and no type', () => {
    expect(describeRule({ hederaEntityId: '0.0.2' })).toBe(
      'This group will be assigned to any transaction involving 0.0.2.',
    );
  });

  test('describes a rule with a role only', () => {
    expect(describeRule({ hederaEntityId: '0.0.2', entityRole: 'sender' })).toBe(
      'This group will be assigned to any transaction where 0.0.2 is the sender.',
    );
  });

  test('describes a rule with a transaction type only', () => {
    expect(describeRule({ hederaEntityId: '0.0.2', transactionType: 'CRYPTOTRANSFER' })).toBe(
      'This group will be assigned to any Transfer transaction involving 0.0.2.',
    );
  });

  test('describes a rule with both role and type', () => {
    expect(
      describeRule({
        hederaEntityId: '0.0.2',
        entityRole: 'sender',
        transactionType: 'CRYPTOTRANSFER',
      }),
    ).toBe('This group will be assigned to any Transfer transaction where 0.0.2 is the sender.');
  });

  test('maps fee_payer to a readable label', () => {
    expect(describeRule({ hederaEntityId: '0.0.2', entityRole: 'fee_payer' })).toBe(
      'This group will be assigned to any transaction where 0.0.2 is the fee payer.',
    );
  });

  test('falls back to the raw string for an unrecognized transaction type', () => {
    expect(describeRule({ hederaEntityId: '0.0.2', transactionType: 'SOMETHINGNEW' })).toBe(
      'This group will be assigned to any SOMETHINGNEW transaction involving 0.0.2.',
    );
  });
});

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
    expect(formatTransactionType('CRYPTOTRANSFER')).toBe('Transfer');
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
