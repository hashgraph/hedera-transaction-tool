// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { Organization } from '@prisma/client';
import { getConnectedOrganization } from '@renderer/utils/userStoreHelpers';
import { healthCheck, getUserState } from '@renderer/services/organization';
import { shouldSignInOrganization } from '@renderer/services/organizationCredentials';

vi.mock('@renderer/services/organization', () => ({
  healthCheck: vi.fn(),
  getUserState: vi.fn(),
  updateKey: vi.fn(),
  uploadKey: vi.fn(),
}));
vi.mock('@renderer/services/organizationCredentials', () => ({
  shouldSignInOrganization: vi.fn(),
  deleteOrganizationCredentials: vi.fn(),
  getOrganizationTokens: vi.fn(),
}));
vi.mock('@renderer/services/keyPairService');
vi.mock('@renderer/services/organizationsService');
vi.mock('@renderer/services/electronUtilsService');
vi.mock('@renderer/services/mnemonicService');
vi.mock('@renderer/services/publicKeyMappingService');
vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  }),
}));

const org: Organization = {
  id: 'org-1',
  nickname: 'Org',
  serverUrl: 'https://org.example.com',
  key: 'k',
};
const user = { isLoggedIn: true, id: 'user-1', email: 'a@b.c', password: 'pw' } as never;

describe('getConnectedOrganization - 14.4.1 organization server unreachable', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('marks the org inactive when the health check reports unreachable', async () => {
    vi.mocked(healthCheck).mockResolvedValue(false);

    const result = await getConnectedOrganization(org, user);

    expect(result).toMatchObject({
      id: 'org-1',
      isServerActive: false,
      isLoading: false,
      loginRequired: false,
    });
    expect(shouldSignInOrganization).not.toHaveBeenCalled();
    expect(getUserState).not.toHaveBeenCalled();
  });

  test('marks the org inactive instead of throwing when the health check throws', async () => {
    vi.mocked(healthCheck).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await getConnectedOrganization(org, user);

    expect(result).toMatchObject({ isServerActive: false, isLoading: false });
  });

  test('keeps the org active but requiring login when user state cannot be fetched', async () => {
    vi.mocked(healthCheck).mockResolvedValue(true);
    vi.mocked(shouldSignInOrganization).mockResolvedValue(false);
    vi.mocked(getUserState).mockRejectedValue(new Error('Network Error'));

    const result = await getConnectedOrganization(org, user);

    expect(result).toMatchObject({ isServerActive: true, loginRequired: true });
  });
});
