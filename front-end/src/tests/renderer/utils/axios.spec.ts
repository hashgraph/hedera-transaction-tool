// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockOrgs: Array<{ id: string; serverUrl: string; nickname?: string }> = [];
let mockGetJwtToken = vi.fn((_id: string) => null as string | null);
let mockClearJwtToken = vi.fn();
let mockSignalReauth = vi.fn();
let mockPersonal: any = null;
let mockUpdateCreds = vi.fn().mockResolvedValue(undefined);
let mockIsUserLoggedIn = vi.fn(() => false);

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    organizations: mockOrgs,
    personal: mockPersonal,
    getJwtToken: (id: string) => mockGetJwtToken(id),
    clearJwtToken: (...args: any[]) => mockClearJwtToken(...args),
    signalReauth: () => mockSignalReauth(),
  }),
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  updateOrganizationCredentials: (...args: any[]) => mockUpdateCreds(...args),
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: (...args: any[]) => mockIsUserLoggedIn(...args),
}));

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

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
    mockOrgs.push({ id: 'org1', serverUrl: 'https://org.example.com' });

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

describe('handleUnauthorizedResponse (401 interceptor handler)', () => {
  beforeEach(() => {
    mockOrgs.length = 0;
    mockGetJwtToken = vi.fn(() => null);
    mockClearJwtToken = vi.fn();
    mockSignalReauth = vi.fn();
    mockPersonal = null;
    mockUpdateCreds = vi.fn().mockResolvedValue(undefined);
    mockIsUserLoggedIn = vi.fn(() => false);
    vi.resetModules();
  });

  test('does nothing when the URL matches no known org', async () => {
    mockOrgs.push({ id: 'org1', serverUrl: 'https://other.example.com' });
    const { handleUnauthorizedResponse } = await import('@renderer/utils/axios');
    await handleUnauthorizedResponse({ config: { url: 'https://unknown.example.com/users/me' } });
    expect(mockClearJwtToken).not.toHaveBeenCalled();
    expect(mockSignalReauth).not.toHaveBeenCalled();
  });

  test('does nothing when no in-memory token exists for the org', async () => {
    mockOrgs.push({ id: 'org1', serverUrl: 'https://org.example.com' });
    mockGetJwtToken.mockReturnValue(null);

    const { handleUnauthorizedResponse } = await import('@renderer/utils/axios');
    await handleUnauthorizedResponse({ config: { url: 'https://org.example.com/users/me' } });
    expect(mockClearJwtToken).not.toHaveBeenCalled();
    expect(mockSignalReauth).not.toHaveBeenCalled();
  });

  test('clears token, nulls DB token, and signals reauth when server rejects a live token', async () => {
    mockOrgs.push({ id: 'org1', serverUrl: 'https://org.example.com' });
    mockGetJwtToken.mockReturnValue('valid-looking-jwt');
    mockPersonal = { id: 'user1' };
    mockIsUserLoggedIn.mockReturnValue(true);

    const { handleUnauthorizedResponse } = await import('@renderer/utils/axios');
    await handleUnauthorizedResponse({ config: { url: 'https://org.example.com/users/me' } });

    expect(mockClearJwtToken).toHaveBeenCalledWith('org1');
    expect(mockUpdateCreds).toHaveBeenCalledWith(
      'org1',
      'user1',
      undefined,
      undefined,
      null,
    );
    expect(mockSignalReauth).toHaveBeenCalledTimes(1);
  });

  test('skips DB update when user is not logged in', async () => {
    mockOrgs.push({ id: 'org1', serverUrl: 'https://org.example.com' });
    mockGetJwtToken.mockReturnValue('some-token');
    mockPersonal = null;
    mockIsUserLoggedIn.mockReturnValue(false);

    const { handleUnauthorizedResponse } = await import('@renderer/utils/axios');
    await handleUnauthorizedResponse({ config: { url: 'https://org.example.com/users/me' } });

    expect(mockClearJwtToken).toHaveBeenCalledWith('org1');
    expect(mockUpdateCreds).not.toHaveBeenCalled();
    expect(mockSignalReauth).toHaveBeenCalledTimes(1);
  });

  test('deduplicates concurrent 401s for the same org', async () => {
    mockOrgs.push({ id: 'org1', serverUrl: 'https://org.example.com' });
    mockGetJwtToken.mockReturnValue('some-token');
    mockPersonal = { id: 'user1' };
    mockIsUserLoggedIn.mockReturnValue(true);

    // Delay the DB update so the second call arrives while the first is in-flight
    let resolveUpdate!: () => void;
    mockUpdateCreds.mockReturnValue(new Promise<void>(res => { resolveUpdate = res; }));

    const { handleUnauthorizedResponse } = await import('@renderer/utils/axios');

    const first = handleUnauthorizedResponse({ config: { url: 'https://org.example.com/users/me' } });
    const second = handleUnauthorizedResponse({ config: { url: 'https://org.example.com/notifications' } });

    resolveUpdate();
    await Promise.all([first, second]);

    expect(mockSignalReauth).toHaveBeenCalledTimes(1);
    expect(mockUpdateCreds).toHaveBeenCalledTimes(1);
  });
});
