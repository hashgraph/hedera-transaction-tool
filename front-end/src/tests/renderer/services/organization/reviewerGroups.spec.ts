// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getReviewerGroups } from '@renderer/services/organization/reviewerGroups';
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

describe('reviewerGroups service', () => {
  const serverUrl = 'https://org.example.com';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('getReviewerGroups returns the groups on success', async () => {
    const groups = [{ id: 1, name: 'Treasury' }];
    vi.mocked(axiosWithCredentials.get).mockResolvedValueOnce({ data: groups } as AxiosResponse);

    await expect(getReviewerGroups(serverUrl)).resolves.toEqual(groups);
  });

  test('getReviewerGroups returns an empty list when the server has no reviewer-groups route', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosErrorWithStatus(404));

    await expect(getReviewerGroups(serverUrl)).resolves.toEqual([]);
  });

  test('getReviewerGroups throws on a non-404 error', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosErrorWithStatus(500));

    await expect(getReviewerGroups(serverUrl)).rejects.toThrow('Failed to get reviewer groups');
  });
});
