// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

// reconnectOrganization sits on top of many dependencies. We mock everything
// that touches IO or other modules and assert the orchestration: it routes
// through performVersionCheck (which stores fresh data and lets status
// derive from it), inspects the resulting state, and returns
// `requiresUpdate` when the org is belowMinimum.

const performVersionCheckMock = vi.fn<(serverUrl: string) => unknown>();
const loginMock = vi.fn<(...args: unknown[]) => unknown>();
const wsConnectMock = vi.fn();
const setConnectionStatusMock = vi.fn();
const refetchUserStateMock = vi.fn();
const getLocalWebsocketPathMock = vi.fn((u: string) => u + '/ws');
const getAuthTokenMock = vi.fn<() => string>(() => 'existing-token');
const getOrganizationCredentialsMock =
  vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null);
const updateOrganizationCredentialsMock = vi.fn<(...args: unknown[]) => unknown>();

const mockOrgs: Array<{
  id: string;
  serverUrl: string;
  nickname?: string;
  connectionStatus?: string;
  disconnectReason?: string;
  lastDisconnectedAt?: Date;
}> = [];
let mockPersonal: { isLoggedIn: boolean; id?: string; password?: string; useKeychain?: boolean } = {
  isLoggedIn: false,
};

vi.mock('@renderer/composables/useVersionCheck', () => ({
  default: () => ({
    performVersionCheck: (serverUrl: string) => performVersionCheckMock(serverUrl),
  }),
}));

vi.mock('@renderer/services/organization', () => ({
  login: (...args: unknown[]) => loginMock(...args),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    organizations: mockOrgs,
    personal: mockPersonal,
    getJwtToken: getAuthTokenMock,
    refetchUserState: refetchUserStateMock
  }),
}));

vi.mock('@renderer/stores/storeWebsocketConnection', () => ({
  default: () => ({ connect: wsConnectMock }),
}));

vi.mock('@renderer/stores/storeOrganizationConnection', () => ({
  default: () => ({ setConnectionStatus: setConnectionStatusMock }),
}));

vi.mock('@renderer/services/organizationsService', () => ({
  getLocalWebsocketPath: (u: string) => getLocalWebsocketPathMock(u),
}));

vi.mock('@renderer/services/organizationCredentials', () => ({
  getOrganizationCredentials: (...args: unknown[]) => getOrganizationCredentialsMock(...args),
  updateOrganizationCredentials: (...args: unknown[]) => updateOrganizationCredentialsMock(...args),
}));
//
// vi.mock('@renderer/utils/userStoreHelpers', () => ({
//   getAuthTokenFromSessionStorage: () => getAuthTokenMock(),
//   toggleAuthTokenInSessionStorage: vi.fn(),
// }));

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

describe('reconnectOrganization', () => {
  beforeEach(() => {
    performVersionCheckMock.mockReset();
    wsConnectMock.mockReset();
    setConnectionStatusMock.mockReset();
    refetchUserStateMock.mockReset();
    loginMock.mockReset();
    getAuthTokenMock.mockReset();
    getAuthTokenMock.mockReturnValue('existing-token');
    getOrganizationCredentialsMock.mockReset();
    getOrganizationCredentialsMock.mockResolvedValue(null);
    updateOrganizationCredentialsMock.mockReset();
    mockOrgs.length = 0;
    mockPersonal = { isLoggedIn: false };
    localStorage.clear();
    vi.resetModules();
  });

  test('returns success when version check passes and connects websocket', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org', nickname: 'Org' });
    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    const state = await import('@renderer/stores/versionState');

    performVersionCheckMock.mockImplementation(async (url: string) => {
      state.setVersionDataForOrg(url, {
        latestSupportedVersion: '1.0.0',
        minimumSupportedVersion: '0.9.0',
        updateUrl: null,
      });
    });

    const result = await reconnectOrganization('https://org');
    expect(result).toEqual({ success: true });
    expect(wsConnectMock).toHaveBeenCalled();
    expect(setConnectionStatusMock).toHaveBeenCalledWith('https://org', 'connected');
    expect(refetchUserStateMock).toHaveBeenCalled();
  });

  test('returns requiresUpdate when version check leaves org belowMinimum', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    const state = await import('@renderer/stores/versionState');

    performVersionCheckMock.mockImplementation(async (url: string) => {
      state.setVersionDataForOrg(url, {
        latestSupportedVersion: '2.0.0',
        minimumSupportedVersion: '1.5.0',
        updateUrl: 'https://download',
      });
    });

    const result = await reconnectOrganization('https://org');
    expect(result).toEqual({ success: false, requiresUpdate: true });
    expect(wsConnectMock).not.toHaveBeenCalled();
    expect(setConnectionStatusMock).not.toHaveBeenCalled();
  });

  test('does not require update when performVersionCheck leaves no version state', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');

    performVersionCheckMock.mockResolvedValueOnce(undefined);

    const result = await reconnectOrganization('https://org');
    expect(result).toEqual({ success: true });
    expect(wsConnectMock).toHaveBeenCalled();
  });

  test('throws when the org is not in the store so the caller can surface it', async () => {
    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    await expect(reconnectOrganization('https://missing')).rejects.toThrow('Organization not found');
  });

  test('rethrows inner errors instead of toasting from this layer', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    performVersionCheckMock.mockRejectedValueOnce(new Error('boom'));

    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    await expect(reconnectOrganization('https://org')).rejects.toThrow('boom');
  });

  test('return type no longer includes hasCompatibilityConflict', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    const state = await import('@renderer/stores/versionState');

    performVersionCheckMock.mockImplementation(async (url: string) => {
      state.setVersionDataForOrg(url, {
        latestSupportedVersion: '2.0.0',
        minimumSupportedVersion: '1.5.0',
        updateUrl: 'https://download',
      });
    });

    const result = await reconnectOrganization('https://org');
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['success', 'requiresUpdate']));
    expect(result).not.toHaveProperty('hasCompatibilityConflict');
  });

  test('treats login 426 without version metadata as reconnect failure', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    mockPersonal = { isLoggedIn: true, id: 'user-1', password: 'pw', useKeychain: false };
    getAuthTokenMock.mockReturnValue(''); // no token → login is attempted
    getOrganizationCredentialsMock.mockResolvedValue({ email: 'a@b', password: 'pw' });

    const { RequestError } = await import('@renderer/utils/axios');
    loginMock.mockRejectedValueOnce(
      new RequestError('Failed to Sign In to Organization', undefined, 426),
    );

    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    performVersionCheckMock.mockResolvedValueOnce(undefined);

    const result = await reconnectOrganization('https://org');
    expect(result).toEqual({ success: false });
    expect(wsConnectMock).not.toHaveBeenCalled();
    // Token storage must not have been touched since the login didn't succeed.
    expect(updateOrganizationCredentialsMock).not.toHaveBeenCalled();
  });

  test('still propagates non-426 login errors', async () => {
    mockOrgs.push({ id: '1', serverUrl: 'https://org' });
    mockPersonal = { isLoggedIn: true, id: 'user-1', password: 'pw', useKeychain: false };
    getAuthTokenMock.mockReturnValue('');
    getOrganizationCredentialsMock.mockResolvedValue({ email: 'a@b', password: 'pw' });

    const { RequestError } = await import('@renderer/utils/axios');
    loginMock.mockRejectedValueOnce(new RequestError('Invalid email or password', undefined, 401));

    const { reconnectOrganization } = await import('@renderer/services/organization/reconnect');
    await expect(reconnectOrganization('https://org')).rejects.toThrow('Invalid email or password');
  });
});
