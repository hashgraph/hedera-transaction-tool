// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';

import { healthCheck } from '@renderer/services/organization/health';

vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

const SERVER = 'https://org.example.com';

describe('healthCheck - 14.4.1 organization server unreachable', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
  });

  test('returns true when the server responds', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: true });

    await expect(healthCheck(SERVER)).resolves.toBe(true);
  });

  test.each(['ECONNREFUSED', 'ENOTFOUND', 'ECONNABORTED', 'ERR_NETWORK'])(
    'returns false instead of throwing on %s',
    async code => {
      vi.mocked(axios.get).mockRejectedValue(new AxiosError('failed', code));

      await expect(healthCheck(SERVER)).resolves.toBe(false);
    },
  );

  test('returns false when the server returns a 5xx', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError(
        'bad gateway',
        'ERR_BAD_RESPONSE',
        undefined,
        {},
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: {},
          config: {} as never,
          data: {},
        },
      ),
    );

    await expect(healthCheck(SERVER)).resolves.toBe(false);
  });

  test('returns false when the response body is empty', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: '' });

    await expect(healthCheck(SERVER)).resolves.toBe(false);
  });

  test('uses a timeout so an unresponsive server cannot hang the check', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: true });

    await healthCheck(SERVER);

    expect(axios.get).toHaveBeenCalledWith(`${SERVER}/`, { timeout: 3000 });
  });
});
