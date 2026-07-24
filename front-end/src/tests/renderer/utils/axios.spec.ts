// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockOrgs: Array<{ serverUrl: string; nickname?: string }> = [];

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ organizations: mockOrgs }),
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
