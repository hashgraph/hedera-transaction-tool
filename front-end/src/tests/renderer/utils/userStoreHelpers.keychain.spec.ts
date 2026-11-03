// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import type { Organization } from '@prisma/client';

import { getConnectedOrganization, getOrganizationJwtTokens } from '@renderer/utils/userStoreHelpers';
import {
  getOrganizationTokens,
  shouldSignInOrganization,
} from '@renderer/services/organizationCredentials';
import { healthCheck } from '@renderer/services/organization';

vi.mock('@renderer/services/organizationCredentials', () => ({
  shouldSignInOrganization: vi.fn(),
  deleteOrganizationCredentials: vi.fn(),
  getOrganizationTokens: vi.fn(),
}));
vi.mock('@renderer/services/organization', () => ({
  healthCheck: vi.fn(),
  getUserState: vi.fn(),
  updateKey: vi.fn(),
  uploadKey: vi.fn(),
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

const user = { isLoggedIn: true, id: 'user-1', email: 'a@b.c', password: 'pw' } as never;

describe('getOrganizationJwtTokens keychain handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
  });

  test('maps tokens by organization id', async () => {
    vi.mocked(getOrganizationTokens).mockResolvedValue([
      { organization_id: 'org-1', jwtToken: 'token' },
    ]);

    expect(await getOrganizationJwtTokens(user)).toEqual({ 'org-1': 'token' });
  });

});

describe('getConnectedOrganization keychain handling', () => {
  const org: Organization = {
    id: 'org-1',
    nickname: 'Org',
    serverUrl: 'https://org.example.com',
    key: 'k',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    vi.mocked(healthCheck).mockResolvedValue(true);
  });

  test('keeps the org active but requiring login when the sign-in check fails', async () => {
    vi.mocked(shouldSignInOrganization).mockRejectedValue(new Error(KEYCHAIN_UNAVAILABLE_MESSAGE));

    const result = await getConnectedOrganization(org, user);

    expect(result).toMatchObject({ isServerActive: true, loginRequired: true });
  });
});
