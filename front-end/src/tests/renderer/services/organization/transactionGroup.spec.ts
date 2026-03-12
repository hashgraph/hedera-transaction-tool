// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  cancelTransactionGroup,
  type CancelGroupResult,
} from '@renderer/services/organization/transactionGroup';
import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

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

describe('transactionGroup service', () => {
  const serverUrl = 'https://org.example.com';
  const groupId = 123;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('cancelTransactionGroup sends a PATCH request to the group cancel endpoint', async () => {
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

    await expect(cancelTransactionGroup(serverUrl, groupId)).resolves.toEqual(payload);
    expect(commonRequestHandler).toHaveBeenCalledWith(
      expect.any(Function),
      'Failed to cancel transactions in group',
    );
    expect(axiosWithCredentials.patch).toHaveBeenCalledWith(
      `${serverUrl}/transaction-groups/${groupId}/cancel`,
      undefined,
      { withCredentials: true },
    );
  });

  test('cancelTransactionGroup surfaces the user-friendly default error message on failure', async () => {
    vi.mocked(axiosWithCredentials.patch).mockRejectedValueOnce(new Error('network error'));

    await expect(cancelTransactionGroup(serverUrl, groupId)).rejects.toThrow(
      'Failed to cancel transactions in group',
    );
  });
});
