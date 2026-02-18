// @vitest-environment node
import { describe, test, expect, vi } from 'vitest';

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionTypeFromBackendType: vi.fn(),
}));

import {
  TransactionNodeSortField,
  sortFieldToUrl,
  sortFieldFromUrl,
  TRANSACTION_NODE_SORT_URL_VALUES,
} from '@renderer/utils/sortTransactionNodes';

describe('sortTransactionNodes URL mapping', () => {
  describe('sortFieldToUrl', () => {
    test('maps TRANSACTION_ID to "TRANSACTION_ID"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.TRANSACTION_ID)).toBe('TRANSACTION_ID');
    });

    test('maps TRANSACTION_TYPE to "TRANSACTION_TYPE"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.TRANSACTION_TYPE)).toBe('TRANSACTION_TYPE');
    });

    test('maps DESCRIPTION to "DESCRIPTION"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.DESCRIPTION)).toBe('DESCRIPTION');
    });

    test('maps STATUS to "STATUS"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.STATUS)).toBe('STATUS');
    });

    test('maps VALID_START_DATE to "VALID_START_DATE"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.VALID_START_DATE)).toBe('VALID_START_DATE');
    });

    test('maps EXECUTED_AT_DATE to "EXECUTED_AT_DATE"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.EXECUTED_AT_DATE)).toBe('EXECUTED_AT_DATE');
    });

    test('maps CREATED_AT_DATE to "CREATED_AT_DATE"', () => {
      expect(sortFieldToUrl(TransactionNodeSortField.CREATED_AT_DATE)).toBe('CREATED_AT_DATE');
    });
  });

  describe('sortFieldFromUrl', () => {
    test('maps "TRANSACTION_ID" to TRANSACTION_ID', () => {
      expect(sortFieldFromUrl('TRANSACTION_ID')).toBe(TransactionNodeSortField.TRANSACTION_ID);
    });

    test('maps "TRANSACTION_TYPE" to TRANSACTION_TYPE', () => {
      expect(sortFieldFromUrl('TRANSACTION_TYPE')).toBe(TransactionNodeSortField.TRANSACTION_TYPE);
    });

    test('maps "DESCRIPTION" to DESCRIPTION', () => {
      expect(sortFieldFromUrl('DESCRIPTION')).toBe(TransactionNodeSortField.DESCRIPTION);
    });

    test('maps "STATUS" to STATUS', () => {
      expect(sortFieldFromUrl('STATUS')).toBe(TransactionNodeSortField.STATUS);
    });

    test('maps "VALID_START_DATE" to VALID_START_DATE', () => {
      expect(sortFieldFromUrl('VALID_START_DATE')).toBe(TransactionNodeSortField.VALID_START_DATE);
    });

    test('maps "EXECUTED_AT_DATE" to EXECUTED_AT_DATE', () => {
      expect(sortFieldFromUrl('EXECUTED_AT_DATE')).toBe(TransactionNodeSortField.EXECUTED_AT_DATE);
    });

    test('maps "CREATED_AT_DATE" to CREATED_AT_DATE', () => {
      expect(sortFieldFromUrl('CREATED_AT_DATE')).toBe(TransactionNodeSortField.CREATED_AT_DATE);
    });

    test('returns undefined for unknown string', () => {
      expect(sortFieldFromUrl('BOGUS')).toBeUndefined();
    });

    test('returns undefined for empty string', () => {
      expect(sortFieldFromUrl('')).toBeUndefined();
    });

    test('returns undefined for lowercase variant', () => {
      expect(sortFieldFromUrl('transaction_id')).toBeUndefined();
    });
  });

  describe('roundtrip', () => {
    test.each([
      TransactionNodeSortField.TRANSACTION_ID,
      TransactionNodeSortField.TRANSACTION_TYPE,
      TransactionNodeSortField.DESCRIPTION,
      TransactionNodeSortField.STATUS,
      TransactionNodeSortField.VALID_START_DATE,
      TransactionNodeSortField.EXECUTED_AT_DATE,
      TransactionNodeSortField.CREATED_AT_DATE,
    ])('roundtrips enum value %i through URL string and back', (field) => {
      const urlString = sortFieldToUrl(field);
      const restored = sortFieldFromUrl(urlString);
      expect(restored).toBe(field);
    });
  });

  describe('TRANSACTION_NODE_SORT_URL_VALUES', () => {
    test('contains all 7 sort field URL strings', () => {
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toHaveLength(7);
    });

    test('includes every expected URL string', () => {
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('TRANSACTION_ID');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('TRANSACTION_TYPE');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('DESCRIPTION');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('STATUS');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('VALID_START_DATE');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('EXECUTED_AT_DATE');
      expect(TRANSACTION_NODE_SORT_URL_VALUES).toContain('CREATED_AT_DATE');
    });

    test('every value can be resolved back to an enum', () => {
      for (const urlValue of TRANSACTION_NODE_SORT_URL_VALUES) {
        expect(sortFieldFromUrl(urlValue)).toBeDefined();
      }
    });
  });
});
