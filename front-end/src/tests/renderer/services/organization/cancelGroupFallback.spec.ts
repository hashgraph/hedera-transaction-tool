// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TransactionStatus } from '@shared/interfaces';

vi.mock('@renderer/utils', () => ({
  axiosWithCredentials: { patch: vi.fn() },
  commonRequestHandler: vi.fn(),
}));

vi.mock('@renderer/services/organization/transaction', () => ({
  cancelTransaction: vi.fn(),
}));

import { cancelGroupFallback } from '@renderer/services/organization/cancelGroupFallback';
import {
  CancelFailureCode,
  type IGroupItem,
} from '@renderer/services/organization/transactionGroup';

const serverUrl = 'https://org.example.com';

function makeGroupItem(
  transactionId: number,
  status: TransactionStatus,
): IGroupItem {
  return {
    seq: transactionId,
    transactionId,
    transaction: { status } as any,
  };
}

describe('cancelGroupFallback', () => {
  let cancelOne: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancelOne = vi.fn().mockResolvedValue(true);
  });

  test('cancels all in-progress items successfully', async () => {
    const items = [
      makeGroupItem(1, TransactionStatus.WAITING_FOR_SIGNATURES),
      makeGroupItem(2, TransactionStatus.WAITING_FOR_EXECUTION),
      makeGroupItem(3, TransactionStatus.NEW),
    ];

    const result = await cancelGroupFallback(serverUrl, items, cancelOne);

    expect(result.canceled).toEqual([1, 2, 3]);
    expect(result.alreadyCanceled).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.summary).toEqual({
      processedCount: 3,
      canceled: 3,
      alreadyCanceled: 0,
      failed: 0,
    });
    expect(cancelOne).toHaveBeenCalledTimes(3);
  });

  test('handles mixed statuses correctly', async () => {
    const items = [
      makeGroupItem(1, TransactionStatus.WAITING_FOR_SIGNATURES),
      makeGroupItem(2, TransactionStatus.CANCELED),
      makeGroupItem(3, TransactionStatus.EXECUTED),
    ];

    const result = await cancelGroupFallback(serverUrl, items, cancelOne);

    expect(result.canceled).toEqual([1]);
    expect(result.alreadyCanceled).toEqual([2]);
    expect(result.failed).toEqual([
      {
        id: 3,
        code: CancelFailureCode.NOT_CANCELABLE,
        message: `Transaction is in non-cancelable status: ${TransactionStatus.EXECUTED}`,
      },
    ]);
    expect(result.summary.processedCount).toBe(3);
    expect(cancelOne).toHaveBeenCalledTimes(1);
    expect(cancelOne).toHaveBeenCalledWith(serverUrl, 1);
  });

  test('records partial failures', async () => {
    cancelOne
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('backend error'));

    const items = [
      makeGroupItem(1, TransactionStatus.WAITING_FOR_SIGNATURES),
      makeGroupItem(2, TransactionStatus.WAITING_FOR_SIGNATURES),
    ];

    const result = await cancelGroupFallback(serverUrl, items, cancelOne);

    expect(result.canceled).toEqual([1]);
    expect(result.failed).toEqual([
      { id: 2, code: CancelFailureCode.INTERNAL_ERROR, message: 'backend error' },
    ]);
    expect(result.summary).toEqual({
      processedCount: 2,
      canceled: 1,
      alreadyCanceled: 0,
      failed: 1,
    });
  });

  test('all already canceled', async () => {
    const items = [
      makeGroupItem(1, TransactionStatus.CANCELED),
      makeGroupItem(2, TransactionStatus.CANCELED),
    ];

    const result = await cancelGroupFallback(serverUrl, items, cancelOne);

    expect(result.canceled).toEqual([]);
    expect(result.alreadyCanceled).toEqual([1, 2]);
    expect(result.failed).toEqual([]);
    expect(result.summary.processedCount).toBe(2);
    expect(cancelOne).not.toHaveBeenCalled();
  });

  test('empty group returns empty result', async () => {
    const result = await cancelGroupFallback(serverUrl, [], cancelOne);

    expect(result.canceled).toEqual([]);
    expect(result.alreadyCanceled).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.summary.processedCount).toBe(0);
    expect(cancelOne).not.toHaveBeenCalled();
  });

  test('summary counts match array lengths', async () => {
    cancelOne
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('fail'));

    const items = [
      makeGroupItem(1, TransactionStatus.WAITING_FOR_SIGNATURES),
      makeGroupItem(2, TransactionStatus.WAITING_FOR_SIGNATURES),
      makeGroupItem(3, TransactionStatus.CANCELED),
      makeGroupItem(4, TransactionStatus.EXECUTED),
    ];

    const result = await cancelGroupFallback(serverUrl, items, cancelOne);

    expect(result.summary.canceled).toBe(result.canceled.length);
    expect(result.summary.alreadyCanceled).toBe(result.alreadyCanceled.length);
    expect(result.summary.failed).toBe(result.failed.length);
    expect(result.summary.processedCount).toBe(
      result.canceled.length + result.alreadyCanceled.length + result.failed.length,
    );
  });

  test('uses fallback message when cancelOne rejects with a non-Error value', async () => {
    cancelOne.mockRejectedValueOnce('some string rejection');
    const items = [makeGroupItem(1, TransactionStatus.WAITING_FOR_SIGNATURES)];
    const result = await cancelGroupFallback(serverUrl, items, cancelOne);
    expect(result.failed).toEqual([
      { id: 1, code: CancelFailureCode.INTERNAL_ERROR, message: 'Failed to cancel transaction' },
    ]);
  });
});
