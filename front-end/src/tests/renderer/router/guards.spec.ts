import { beforeEach, describe, expect, test, vi } from 'vitest';

import { addGuards } from '@renderer/router/guards';

const mockUser: {
  personal: { isLoggedIn: boolean } | null;
  selectedOrganization: unknown;
  accountSetupStarted: boolean;
} = {
  personal: { isLoggedIn: true },
  selectedOrganization: null,
  accountSetupStarted: false,
};
const mockShouldShowAccountSetup = vi.fn();
const mockIsLoggedInOrganization = vi.fn();
const mockFeature = vi.hoisted(() => ({ reviewer: false }));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mockUser }));
vi.mock('@renderer/stores/storeAccountSetup.ts', () => ({
  default: () => ({ shouldShowAccountSetup: mockShouldShowAccountSetup }),
}));
vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: (org: unknown) => mockIsLoggedInOrganization(org),
}));
vi.mock('@shared/constants', () => ({
  get FEATURE_REVIEWER_ENABLED() {
    return mockFeature.reviewer;
  },
}));

type Route = { name?: string; path?: string; meta?: Record<string, unknown>; query?: object };

describe('router guards', () => {
  let guard: (to: Route, from: Route) => Promise<unknown>;
  let router: Record<string, unknown>;

  const run = (to: Route, from: Route = { name: 'transactions', path: '/transactions' }) =>
    guard({ meta: {}, ...to }, { meta: {}, query: {}, ...from });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.personal = { isLoggedIn: true };
    mockUser.selectedOrganization = null;
    mockUser.accountSetupStarted = false;
    mockFeature.reviewer = false;
    mockShouldShowAccountSetup.mockResolvedValue(false);
    mockIsLoggedInOrganization.mockReturnValue(false);

    router = { beforeEach: vi.fn(cb => (guard = cb)) };
    addGuards(router as never);
  });

  describe('account setup in progress', () => {
    beforeEach(() => {
      mockUser.accountSetupStarted = true;
    });

    test('blocks navigation to any other route', async () => {
      expect(await run({ name: 'transactions' })).toBe(false);
      expect(await run({ name: 'settings' })).toBe(false);
    });

    test('allows staying on accountSetup', async () => {
      expect(await run({ name: 'accountSetup' })).toBe(true);
    });
  });

  describe('account setup required', () => {
    beforeEach(() => {
      mockShouldShowAccountSetup.mockResolvedValue(true);
    });

    test('redirects a logged-in user to accountSetup', async () => {
      expect(await run({ name: 'transactions' })).toEqual({ name: 'accountSetup' });
    });

    test('does not redirect when already going to accountSetup', async () => {
      expect(await run({ name: 'accountSetup' })).toBe(true);
    });

    test('does not redirect when not logged in', async () => {
      mockUser.personal = { isLoggedIn: false };
      expect(await run({ name: 'login', meta: { withoutAuth: true } })).toBe(true);
    });

    test('does not redirect when org is selected but not logged in to it', async () => {
      mockUser.selectedOrganization = { serverUrl: 'x' };
      mockIsLoggedInOrganization.mockReturnValue(false);
      expect(await run({ name: 'transactions' })).toBe(true);
    });

    test('redirects when org is selected and logged in', async () => {
      mockUser.selectedOrganization = { serverUrl: 'x', admin: false };
      mockIsLoggedInOrganization.mockReturnValue(true);
      expect(await run({ name: 'transactions' })).toEqual({ name: 'accountSetup' });
    });
  });

  describe('accountSetup access', () => {
    test('redirects to transactions when setup is not needed', async () => {
      expect(await run({ name: 'accountSetup' })).toEqual({ name: 'transactions' });
    });

    test('redirects logged-out user away from accountSetup', async () => {
      mockUser.personal = { isLoggedIn: false };
      mockShouldShowAccountSetup.mockResolvedValue(true);
      expect(await run({ name: 'accountSetup' })).toEqual({ name: 'transactions' });
    });
  });

  describe('role and organization restrictions', () => {
    test('redirects non-admin from onlyAdmin routes', async () => {
      mockUser.selectedOrganization = { admin: false };
      mockIsLoggedInOrganization.mockReturnValue(true);
      expect(await run({ name: 'users', meta: { onlyAdmin: true } })).toEqual({
        name: 'transactions',
      });
    });

    test('allows admin on onlyAdmin routes', async () => {
      mockUser.selectedOrganization = { admin: true };
      mockIsLoggedInOrganization.mockReturnValue(true);
      expect(await run({ name: 'users', meta: { onlyAdmin: true } })).toBe(true);
    });

    test('redirects from onlyOrganization routes when not logged in to an org', async () => {
      expect(await run({ name: 'contacts', meta: { onlyOrganization: true } })).toEqual({
        name: 'transactions',
      });
    });

    test('allows onlyOrganization routes when logged in to an org', async () => {
      mockUser.selectedOrganization = { admin: false };
      mockIsLoggedInOrganization.mockReturnValue(true);
      expect(await run({ name: 'contacts', meta: { onlyOrganization: true } })).toBe(true);
    });

    test.each(['reviewerGroups', 'createReviewerGroup'])(
      'redirects %s when the reviewer feature is disabled',
      async name => {
        expect(await run({ name })).toEqual({ name: 'transactions' });
      },
    );

    test('allows reviewer group routes when the feature is enabled', async () => {
      mockFeature.reviewer = true;
      expect(await run({ name: 'reviewerGroups' })).toBe(true);
    });
  });

  describe('auth redirects', () => {
    test('redirects unauthenticated user to login', async () => {
      mockUser.personal = { isLoggedIn: false };
      expect(await run({ name: 'transactions' })).toEqual({ name: 'login' });
    });

    test('allows unauthenticated user on withoutAuth routes', async () => {
      mockUser.personal = { isLoggedIn: false };
      expect(await run({ name: 'login', meta: { withoutAuth: true } })).toBe(true);
    });

    test('redirects logged-in user away from login', async () => {
      expect(await run({ name: 'login' })).toEqual({ name: 'transactions' });
    });

    test('redirects logged-in user away from migrate', async () => {
      expect(await run({ name: 'migrate' })).toEqual({ name: 'transactions' });
    });

    test('redirects away from organizationLogin when already logged in to the org', async () => {
      mockUser.selectedOrganization = { admin: false };
      mockIsLoggedInOrganization.mockReturnValue(true);
      expect(await run({ name: 'organizationLogin' })).toEqual({ name: 'transactions' });
    });
  });

  describe('previousPath / previousTab tracking', () => {
    test('records previousPath and uses it for redirects', async () => {
      await run({ name: 'settings' }, { name: 'accountKeys', path: '/keys' });
      expect(router.previousPath).toBe('/keys');
      expect(await run({ name: 'login' })).toEqual({ path: '/keys' });
    });

    test.each(['login', 'organizationLogin', 'accountSetup', 'migrate', 'index'])(
      'does not record previousPath when coming from %s',
      async name => {
        await run({ name: 'settings' }, { name, path: '/excluded' });
        expect(router.previousPath).toBeUndefined();
      },
    );

    test('records previousTab when leaving transactions', async () => {
      await run(
        { name: 'settings' },
        { name: 'transactions', path: '/transactions', query: { tab: 'History' } },
      );
      expect(router.previousTab).toBe('History');
    });
  });
});
