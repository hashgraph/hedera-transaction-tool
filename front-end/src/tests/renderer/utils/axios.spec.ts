// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';

const mockOrgs: Array<{ serverUrl: string; nickname?: string }> = [];

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ organizations: mockOrgs }),
}));

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

const createAxiosError = (status: number, data: Record<string, unknown> = {}): AxiosError =>
  new AxiosError('request failed', 'ERR', undefined, undefined, {
    status,
    data,
    statusText: 'error',
    headers: {},
    config: {} as any,
  } as AxiosResponse);

describe('commonRequestHandler', () => {
  test('uses the default message on a 401 when messageOn401 is not provided', async () => {
    const { commonRequestHandler, RequestError } = await import('@renderer/utils/axios');

    const call = commonRequestHandler(async () => {
      throw createAxiosError(401, { message: 'Incorrect token' });
    }, 'Failed to verify password reset');

    await expect(call).rejects.toThrow(RequestError);
    await expect(call).rejects.toThrow('Failed to verify password reset');
  });

  test('passing an empty messageOn401 lets the backend message through on a 401', async () => {
    const { commonRequestHandler } = await import('@renderer/utils/axios');

    await expect(
      commonRequestHandler(
        async () => {
          throw createAxiosError(401, { message: 'Incorrect token' });
        },
        'Failed to verify password reset',
        '',
      ),
    ).rejects.toThrow('Incorrect token');
  });

  test('a non-empty messageOn401 overrides the backend message on a 401', async () => {
    const { commonRequestHandler } = await import('@renderer/utils/axios');

    await expect(
      commonRequestHandler(
        async () => {
          throw createAxiosError(401, { message: 'from the backend' });
        },
        'Failed to sign in',
        'Invalid email or password',
      ),
    ).rejects.toThrow('Invalid email or password');
  });
});

describe('handleAxiosResponseError (426 interceptor handler)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockOrgs.length = 0;
    vi.resetModules();
  });

  test('does nothing for non-426 errors', async () => {
    const { handleAxiosResponseError } = await import('@renderer/utils/axios');
    const state = await import('@renderer/stores/versionState');
    handleAxiosResponseError({
      response: { status: 500, data: {} },
      config: { url: 'https://org.example.com/api' },
    });
    expect(state.organizationVersionData.value['https://org.example.com']).toBeUndefined();
  });

  test('does nothing when the serverUrl cannot be extracted', async () => {
    const { handleAxiosResponseError } = await import('@renderer/utils/axios');
    const state = await import('@renderer/stores/versionState');
    handleAxiosResponseError({
      response: {
        status: 426,
        data: { latestSupportedVersion: '2.0.0', minimumSupportedVersion: '1.5.0' },
      },
      config: { url: '' },
    });
    expect(state.organizationVersionData.value).toEqual({});
  });

  test('on 426 with absolute URL, stores parsed data and derives belowMinimum status', async () => {
    const { handleAxiosResponseError } = await import('@renderer/utils/axios');
    const state = await import('@renderer/stores/versionState');
    handleAxiosResponseError({
      response: {
        status: 426,
        data: {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.5.0',
          updateUrl: 'https://download/v2',
        },
      },
      config: { url: 'https://org.example.com/v1/users/version-check' },
    });
    expect(state.organizationVersionData.value['https://org.example.com']).toEqual({
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://download/v2',
    });
    expect(state.organizationVersionStatus.value['https://org.example.com']).toBe('belowMinimum');
  });

  test('ignores 426 responses that lack required version fields', async () => {
    mockOrgs.push({ serverUrl: 'https://org.example.com' });

    const { handleAxiosResponseError } = await import('@renderer/utils/axios');
    const state = await import('@renderer/stores/versionState');

    handleAxiosResponseError({
      response: {
        status: 426,
        data: { updateUrl: 'https://download/v2' },
      },
      config: { url: 'https://org.example.com/v1/api' },
    });

    expect(state.organizationVersionData.value['https://org.example.com']).toBeUndefined();
    expect(state.organizationVersionStatus.value['https://org.example.com']).toBeUndefined();
  });

  test('valid 426 payloads refresh previously stored version data', async () => {
    const { handleAxiosResponseError } = await import('@renderer/utils/axios');
    const state = await import('@renderer/stores/versionState');

    state.setVersionDataForOrg('https://org.example.com', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://prior',
    });

    handleAxiosResponseError({
      response: {
        status: 426,
        data: {
          latestSupportedVersion: '2.1.0',
          minimumSupportedVersion: '1.6.0',
          updateUrl: 'https://newer',
        },
      },
      config: { url: 'https://org.example.com/v1/api' },
    });

    expect(state.organizationVersionStatus.value['https://org.example.com']).toBe('belowMinimum');
    // Fresh 426 body wins; the cached updateUrl is overwritten.
    expect(state.organizationUpdateUrls.value['https://org.example.com']).toBe('https://newer');
  });
});
