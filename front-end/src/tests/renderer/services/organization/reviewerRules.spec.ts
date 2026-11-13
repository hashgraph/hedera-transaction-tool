// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getReviewerRules } from '@renderer/services/organization/reviewerRules';
import { axiosWithCredentials } from '@renderer/utils';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('@renderer/utils', () => ({
  axiosWithCredentials: {
    get: vi.fn(),
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

function axiosErrorWithStatus(status: number) {
  return new AxiosError('error', String(status), undefined, undefined, {
    status,
    data: {},
    statusText: '',
    headers: {},
    config: {} as any,
  });
}

describe('reviewerRules service', () => {
  const serverUrl = 'https://org.example.com';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('getReviewerRules returns the rules on success', async () => {
    const rules = [{ id: 1, groupId: 1 }];
    vi.mocked(axiosWithCredentials.get).mockResolvedValueOnce({ data: rules } as AxiosResponse);

    await expect(getReviewerRules(serverUrl)).resolves.toEqual(rules);
  });

  test('getReviewerRules returns an empty list when the server has no reviewer-rules route', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosErrorWithStatus(404));

    await expect(getReviewerRules(serverUrl)).resolves.toEqual([]);
  });

  test('getReviewerRules throws on a non-404 error', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosErrorWithStatus(500));

    await expect(getReviewerRules(serverUrl)).rejects.toThrow('Failed to get reviewer rules');
  });
});
