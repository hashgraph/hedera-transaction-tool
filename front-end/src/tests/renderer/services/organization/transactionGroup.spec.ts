// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  cancelTransactionGroup,
  type CancelGroupResult,
  type IGroupItem,
} from '@renderer/services/organization/transactionGroup';
import { axiosWithCredentials } from '@renderer/utils';
import { AxiosError } from 'axios';

vi.mock('@renderer/utils', () => ({
  axiosWithCredentials: {
    patch: vi.fn(),
  },
  commonRequestHandler: vi.fn(
    async <T>(callback: () => Promise<T>, defaultMessage: string): Promise<T> => {
      try {
        return await callback();
      } catch {
        throw new Error(defaultMessage);
      }
    },
  ),
}));

import { cancelTransaction } from '@renderer/services/organization/transaction';

vi.mock('@renderer/services/organization/transaction', () => ({
  cancelTransaction: vi.fn(),
}));

const mockCancelGroupFallback = vi.fn();
vi.mock('@renderer/services/organization/cancelGroupFallback', () => ({
  cancelGroupFallback: (...args: unknown[]) => mockCancelGroupFallback(...args),
}));

describe('transactionGroup service', () => {
  const serverUrl = 'https://org.example.com';
  const groupId = 123;
  const groupItems: IGroupItem[] = [];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('cancelTransactionGroup returns CancelGroupResult on success', async () => {
    const payload: CancelGroupResult = {
      canceled: [1],
      alreadyCanceled: [],
      failed: [],
      summary: {
        processedCount: 1,
        canceled: 1,
        alreadyCanceled: 0,
        failed: 0,
      },
    };

    vi.mocked(axiosWithCredentials.patch).mockResolvedValueOnce({ data: payload } as any);

    await expect(cancelTransactionGroup(serverUrl, groupId, groupItems)).resolves.toEqual(payload);
    expect(axiosWithCredentials.patch).toHaveBeenCalledWith(
      `${serverUrl}/transaction-groups/${groupId}/cancel`,
      undefined,
      { withCredentials: true },
    );
  });

  test('cancelTransactionGroup falls back on 404', async () => {
    const axiosError = new AxiosError('Not Found', '404', undefined, undefined, {
      status: 404,
      data: {},
      statusText: 'Not Found',
      headers: {},
      config: {} as any,
    });
    vi.mocked(axiosWithCredentials.patch).mockRejectedValueOnce(axiosError);

    const fallbackResult: CancelGroupResult = {
      canceled: [1],
      alreadyCanceled: [],
      failed: [],
      summary: { processedCount: 1, canceled: 1, alreadyCanceled: 0, failed: 0 },
    };
    mockCancelGroupFallback.mockResolvedValueOnce(fallbackResult);

    const result = await cancelTransactionGroup(serverUrl, groupId, groupItems);
    expect(result).toEqual(fallbackResult);
    expect(mockCancelGroupFallback).toHaveBeenCalledWith(
      serverUrl,
      groupItems,
      cancelTransaction,
    );
  });

  test('cancelTransactionGroup throws on non-404 error', async () => {
    const axiosError = new AxiosError('Server Error', '500', undefined, undefined, {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as any,
    });
    vi.mocked(axiosWithCredentials.patch).mockRejectedValueOnce(axiosError);

    await expect(cancelTransactionGroup(serverUrl, groupId, groupItems)).rejects.toThrow(
      'Failed to cancel transactions in group',
    );
    expect(mockCancelGroupFallback).not.toHaveBeenCalled();
  });

  test('cancelTransactionGroup throws on network error (no response)', async () => {
    vi.mocked(axiosWithCredentials.patch).mockRejectedValueOnce(new Error('network error'));

    await expect(cancelTransactionGroup(serverUrl, groupId, groupItems)).rejects.toThrow(
      'Failed to cancel transactions in group',
    );
    expect(mockCancelGroupFallback).not.toHaveBeenCalled();
  });
});
