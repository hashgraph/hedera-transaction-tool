// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import axios, { AxiosError, type AxiosResponse } from 'axios';
import { axiosWithCredentials } from '@renderer/utils';
import MockAdapter from 'axios-mock-adapter';
import type { OrganizationTokens } from '@renderer/types';

const mockOrgs: Array<{ serverUrl: string; nickname?: string; id?: string }> = [];
const mockTokens: OrganizationTokens = {};

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    organizations: mockOrgs,
    organizationTokens: mockTokens,
    getJwtToken: (url: string) => mockTokens[url],
    clearJwtToken: (url: string) => (mockTokens[url] = null),
    refetchUserState: () => {},
  }),
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

  test('messageOn401 overrides the backend message on a 401', async () => {
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

  test('statusMessages overrides the message for a specific status, taking priority over messageOn401', async () => {
    const { commonRequestHandler } = await import('@renderer/utils/axios');

    await expect(
      commonRequestHandler(
        async () => {
          throw createAxiosError(429, { message: 'from the backend' });
        },
        'Failed to verify password reset',
        'Incorrect code. Please try again.',
        { 429: 'Too many attempts. Please request a new code.' },
      ),
    ).rejects.toThrow('Too many attempts. Please request a new code.');
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

describe('AxiosWithCredentials', () => {

  const url = 'https://example.com';
  const orgId = 'exampleId';
  const config = { maxContentLength: 42 };
  const requestData = 'Nice request';
  const responseData = 'Nice response';
  const successStatus = 200;
  const jwtToken = 'Bioutiful token';

  const mock = new MockAdapter(axios);
  afterEach(() => mock.reset());

  test('get()', async () => {
    mock.onGet(url).reply(successStatus, responseData);
    mockOrgs.push({ serverUrl: url, id: orgId });
    mockTokens[orgId] = jwtToken;

    const response = await axiosWithCredentials.get(url, config);
    expect(response.status).toBe(successStatus);
    expect(response.data).toBe(responseData);
    expect(response.config.headers['Authorization']).toBe(`bearer ${jwtToken}`);
    expect(response.config.maxContentLength).toBe(config.maxContentLength);
  });

  test('post()', async () => {
    mock.onPost(url, requestData).reply(successStatus, responseData);
    mockOrgs.push({ serverUrl: url, id: orgId });
    mockTokens[orgId] = jwtToken;

    const response = await axiosWithCredentials.post(url, requestData, config);
    expect(response.status).toBe(successStatus);
    expect(response.data).toBe(responseData);
    expect(response.config.data).toBe(requestData);
    expect(response.config.headers['Authorization']).toBe(`bearer ${jwtToken}`);
    expect(response.config.maxContentLength).toBe(config.maxContentLength);
  });

  test('patch()', async () => {
    mock.onPatch(url, requestData).reply(successStatus, responseData);
    mockOrgs.push({ serverUrl: url, id: orgId });
    mockTokens[orgId] = jwtToken;

    const response = await axiosWithCredentials.patch(url, requestData, config);
    expect(response.status).toBe(successStatus);
    expect(response.data).toBe(responseData);
    expect(response.config.data).toBe(requestData);
    expect(response.config.headers['Authorization']).toBe(`bearer ${jwtToken}`);
    expect(response.config.maxContentLength).toBe(config.maxContentLength);
  });

  test('delete()', async () => {
    mock.onDelete(url).reply(successStatus);
    mockOrgs.push({ serverUrl: url, id: orgId });
    mockTokens[orgId] = jwtToken;

    await axiosWithCredentials.delete(url, config);
    expect(mock.history.delete.length).toBe(1);
    const axiosConfig = mock.history.delete[0];
    expect(axiosConfig.headers!['Authorization']).toBe(`bearer ${jwtToken}`);
    expect(axiosConfig.maxContentLength).toBe(config.maxContentLength);
  });

});
