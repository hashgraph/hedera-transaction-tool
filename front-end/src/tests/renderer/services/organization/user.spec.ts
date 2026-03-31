// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPublicKeyOwner } from '@renderer/services/organization/user';
import { axiosWithCredentials } from '@renderer/utils';
import { AxiosError } from 'axios';

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

describe('getPublicKeyOwner', () => {
  const serverUrl = 'https://org.example.com';
  const publicKey = '2434cdf54e5f33570791bebdf3f0527347c2310c66f3db6799d64ed9b8666c39';

  beforeEach(() => {
    vi.resetAllMocks();
  });

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

  test('returns null on 401 Unauthorized (expired JWT)', async () => {
    const axiosError = new AxiosError('Unauthorized', '401', undefined, undefined, {
      status: 401,
      data: { message: 'Unauthorized', statusCode: 401 },
      statusText: 'Unauthorized',
      headers: {},
      config: {} as any,
    });
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosError);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBeNull();
  });

  test('returns null on 429 Too Many Requests', async () => {
    const axiosError = new AxiosError('Too Many Requests', '429', undefined, undefined, {
      status: 429,
      data: { message: 'Too Many Requests' },
      statusText: 'Too Many Requests',
      headers: {},
      config: {} as any,
    });
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosError);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBeNull();
  });

  test('returns null on 500 Internal Server Error', async () => {
    const axiosError = new AxiosError('Server Error', '500', undefined, undefined, {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as any,
    });
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosError);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBeNull();
  });

  test('returns null on network error (no response from server)', async () => {
    const axiosError = new AxiosError('Network Error', 'ERR_NETWORK');
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(axiosError);

    const result = await getPublicKeyOwner(serverUrl, publicKey);

    expect(result).toBeNull();
  });

  test('throws non-Axios errors (unexpected runtime bugs)', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      new TypeError('Cannot read properties of undefined'),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(TypeError);
  });

  test('throws RangeError instead of swallowing it', async () => {
    vi.mocked(axiosWithCredentials.get).mockRejectedValueOnce(
      new RangeError('Invalid array length'),
    );

    await expect(getPublicKeyOwner(serverUrl, publicKey)).rejects.toThrow(RangeError);
  });
});
