// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPublicKeyOwner } from '@renderer/services/organization/user';
import { axiosWithCredentials } from '@renderer/utils';
import { AxiosError, type AxiosResponse } from 'axios';

import {
  PUBLIC_KEY_OWNER_DEFAULT_MESSAGE,
  PUBLIC_KEY_OWNER_STATUS_MESSAGES,
  SESSION_EXPIRED_MESSAGE,
} from '@renderer/services/organization/errorMessages';

// Replicate the real commonRequestHandler logic so we test the actual behavior
// of getPublicKeyOwner with its messageOn401 and statusMessages params
vi.mock('@renderer/utils', () => ({
  axiosWithCredentials: {
    get: vi.fn(),
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
            message = messageOn401.trim() || error.response.data?.message;
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
): AxiosError => {
  return new AxiosError(message, code, undefined, undefined, {
    status,
    data,
    statusText: message,
    headers: {},
    config: {} as any,
  } as AxiosResponse);
};

describe('getPublicKeyOwner', () => {
  const serverUrl = 'https://org.example.com';
  const publicKey = '2434cdf54e5f33570791bebdf3f0527347c2310c66f3db6799d64ed9b8666c39';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- Happy path ---

  test('returns email when user owns the public key', async () => {
    vi.mocked(axiosWithCredentials.get).mockResolvedValueOnce({
      data: 'alice@example.com',
    } as any);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBe('alice@example.com');
    expect(axiosWithCredentials.get).toHaveBeenCalledWith(
      `${serverUrl}/users/public-owner/${publicKey}`,
    );
  });

  test('returns null when no user owns the public key (empty string response)', async () => {
    vi.mocked(axiosWithCredentials.get).mockResolvedValueOnce({
      data: '',
    } as any);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBeNull();
  });

  // --- 401: throws session-expired message via messageOn401 (the fix for #2411) ---

  test('throws session-expired message on 401 Unauthorized instead of generic error', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Unauthorized', '401', 401, {
        message: 'Unauthorized',
        statusCode: 401,
      }),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
  });

  // --- Status codes with custom messages via statusMessages ---

  test('throws custom message on 403 Forbidden', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Forbidden', '403', 403),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      PUBLIC_KEY_OWNER_STATUS_MESSAGES[403],
    );
  });

  test('throws custom message on 404 Not Found', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Not Found', '404', 404),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      PUBLIC_KEY_OWNER_STATUS_MESSAGES[404],
    );
  });

  test('throws custom message on 500 Internal Server Error', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Server Error', '500', 500),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      PUBLIC_KEY_OWNER_STATUS_MESSAGES[500],
    );
  });

  // --- Other errors ---

  test('throws rate-limit message on 429 Too Many Requests', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Too Many Requests', '429', 429),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      'Too many requests. Please try again later.',
    );
  });

  test('throws default message on unhandled status code (e.g. 418)', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      createAxiosError('Teapot', '418', 418),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      PUBLIC_KEY_OWNER_DEFAULT_MESSAGE,
    );
  });

  test('throws connection error when server is unreachable', async () => {
    const axiosError = new AxiosError('Network Error', 'ERR_NETWORK');
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosError);

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(
      'Failed to connect to the server',
    );
  });
});
