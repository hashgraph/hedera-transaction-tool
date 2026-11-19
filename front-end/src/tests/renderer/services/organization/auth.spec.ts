// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { signUp } from '@renderer/services/organization/auth';
import { axiosWithCredentials } from '@renderer/utils';
import { AxiosError, type AxiosResponse } from 'axios';

// Replicate the real commonRequestHandler logic so we test the actual behavior
// of signUp with its statusMessages param
vi.mock('@renderer/utils', () => ({
  axiosWithCredentials: {
    post: vi.fn(),
  },
  commonRequestHandler: vi.fn(
    async <T>(
      callback: () => Promise<T>,
      defaultMessage: string = 'Failed to send request',
      messageOn401?: string,
      statusMessages?: Partial<Record<number, string>>,
    ): Promise<T> => {
      try {
        return await callback();
      } catch (error) {
        let message = defaultMessage;
        if (error instanceof AxiosError) {
          if (!error.response) {
            throw new Error('Failed to connect to the server');
          }
          const status = error.response.status;
          if (statusMessages?.[status]) {
            message = statusMessages[status]!;
          } else if (status === 401 && messageOn401) {
            message = messageOn401;
          } else if (status === 429) {
            message = 'Too many requests. Please try again later.';
          }
        }
        throw new Error(message);
      }
    },
  ),
}));

const createAxiosError = (
  message: string,
  code: string,
  status: number,
  data: Record<string, unknown> = {},
): AxiosError =>
  new AxiosError(message, code, undefined, undefined, {
    status,
    data,
    statusText: message,
    headers: {},
    config: {} as any,
  } as AxiosResponse);

describe('signUp', () => {
  beforeEach(() => {
    vi.mocked(axiosWithCredentials.post).mockReset();
  });

  test('returns the created user on success', async () => {
    const responseData = {
      id: 42,
      email: 'new.user@example.com',
      createdAt: '2026-11-18T00:00:00.000Z',
    };
    vi.mocked(axiosWithCredentials.post).mockResolvedValueOnce({ data: responseData } as any);

    const result = await signUp('https://org.example.com', 'new.user@example.com');

    expect(result).toEqual(responseData);
    expect(axiosWithCredentials.post).toHaveBeenCalledWith('https://org.example.com/auth/signup', {
      email: 'new.user@example.com',
    });
  });

  test('maps a 422 response to an "Email already exists" error', async () => {
    vi.mocked(axiosWithCredentials.post).mockRejectedValueOnce(
      createAxiosError('Unprocessable Entity', 'ERR_BAD_REQUEST', 422, {
        message: 'Email already exists.',
      }),
    );

    await expect(signUp('https://org.example.com', 'taken@example.com')).rejects.toThrow(
      'Email already exists',
    );
  });

  test('falls back to the default message for an unmapped status', async () => {
    vi.mocked(axiosWithCredentials.post).mockRejectedValueOnce(
      createAxiosError('Internal Server Error', 'ERR_BAD_RESPONSE', 500),
    );

    await expect(signUp('https://org.example.com', 'new.user@example.com')).rejects.toThrow(
      'Failed to sign up the user',
    );
  });
});
