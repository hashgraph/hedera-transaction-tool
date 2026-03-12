// @vitest-environment node
import { describe, expect, test } from 'vitest';
import type { CancelGroupResult } from '@renderer/services/organization/transactionGroup';

import { getCancelGroupToast } from '@renderer/pages/TransactionGroupDetails/cancelGroupResult';

const baseSummary = {
  total: 0,
  canceled: 0,
  alreadyCanceled: 0,
  failed: 0,
};

describe('getCancelGroupToast', () => {
  test('returns success when all cancel attempts succeed', () => {
    const result: CancelGroupResult = {
      canceled: [1, 2],
      alreadyCanceled: [],
      failed: [],
      summary: { ...baseSummary, total: 2, canceled: 2 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'success',
      message: '2 transaction(s) canceled successfully',
    });
  });

  test('returns success when all transactions were already canceled', () => {
    const result: CancelGroupResult = {
      canceled: [],
      alreadyCanceled: [1, 2],
      failed: [],
      summary: { ...baseSummary, total: 2, alreadyCanceled: 2 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'success',
      message: 'All transactions were already canceled',
    });
  });

  test('returns warning for mixed successful and failed outcomes', () => {
    const result: CancelGroupResult = {
      canceled: [1],
      alreadyCanceled: [2],
      failed: [
        {
          id: 3,
          code: 'NOT_CANCELABLE' as CancelGroupResult['failed'][number]['code'],
          message: 'Transaction cannot be canceled in its current state.',
        },
      ],
      summary: { ...baseSummary, total: 3, canceled: 1, alreadyCanceled: 1, failed: 1 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'warning',
      message: '1 canceled, 1 already canceled, 1 failed',
    });
  });

  test('returns combined success when some are canceled and some already canceled', () => {
    const result: CancelGroupResult = {
      canceled: [1],
      alreadyCanceled: [2],
      failed: [],
      summary: { ...baseSummary, total: 2, canceled: 1, alreadyCanceled: 1, failed: 0 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'success',
      message: '1 canceled, 1 already canceled',
    });
  });

  test('returns warning omitting zero counts', () => {
    const result: CancelGroupResult = {
      canceled: [1],
      alreadyCanceled: [],
      failed: [
        {
          id: 3,
          code: 'NOT_CANCELABLE' as CancelGroupResult['failed'][number]['code'],
          message: 'Transaction cannot be canceled in its current state.',
        },
      ],
      summary: { ...baseSummary, total: 2, canceled: 1, alreadyCanceled: 0, failed: 1 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'warning',
      message: '1 canceled, 1 failed',
    });
  });

  test('returns error when all cancel attempts fail', () => {
    const result: CancelGroupResult = {
      canceled: [],
      alreadyCanceled: [],
      failed: [
        {
          id: 3,
          code: 'INTERNAL_ERROR' as CancelGroupResult['failed'][number]['code'],
          message: 'Cancellation failed due to an unexpected error.',
        },
      ],
      summary: { ...baseSummary, total: 1, failed: 1 },
    };

    expect(getCancelGroupToast(result)).toEqual({
      kind: 'error',
      message: 'No transactions could be canceled',
    });
  });
});
