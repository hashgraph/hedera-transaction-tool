// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';

const { mockUserStore, mockSetupStore } = vi.hoisted(() => {
  return {
    mockUserStore: {
      accountSetupStarted: null as boolean | null,
      personal: null as { isLoggedIn: boolean } | null,
      selectedOrganization: null as object | null,
    },
    mockSetupStore: {
      shouldShowAccountSetup: vi.fn<[], Promise<boolean>>(),
    },
  };
});

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mockUserStore),
}));

vi.mock('@renderer/stores/storeAccountSetup.ts', () => ({
  default: vi.fn(() => mockSetupStore),
}));

vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: vi.fn(() => false),
}));

import { isLoggedInOrganization } from '@renderer/utils';
import { addGuards } from '@renderer/router/guards';

type RouteLocation = { name: string; meta: Record<string, unknown>; path?: string; query?: Record<string, unknown> };
type GuardFn = (to: RouteLocation, from: RouteLocation) => Promise<unknown>;

describe('addGuards – account-setup route guard (TC 13.3.3)', () => {
  let capturedGuard: GuardFn;

  const FROM_SAFE: RouteLocation = { name: 'someOtherPage', path: '/other', meta: {}, query: {} };

  beforeEach(() => {
    const mockRouter = {
      beforeEach: vi.fn((cb: GuardFn) => { capturedGuard = cb; }),
      previousPath: undefined as string | undefined,
      previousTab: undefined as string | undefined,
    };

    // Reset shared mock state before each test.
    mockUserStore.accountSetupStarted = null;
    mockUserStore.personal = null;
    mockUserStore.selectedOrganization = null;
    mockSetupStore.shouldShowAccountSetup.mockResolvedValue(false);
    vi.mocked(isLoggedInOrganization).mockReturnValue(false);

    addGuards(mockRouter as never);
  });

  describe('accountSetupStarted early-exit', () => {
    test('allows navigation to accountSetup when accountSetupStarted is true', async () => {
      mockUserStore.accountSetupStarted = true;

      const result = await capturedGuard(
        { name: 'accountSetup', meta: {} },
        FROM_SAFE,
      );

      expect(result).toBe(true);
    });

    test('blocks navigation to transactions when accountSetupStarted is true', async () => {
      mockUserStore.accountSetupStarted = true;

      const result = await capturedGuard(
        { name: 'transactions', meta: {} },
        FROM_SAFE,
      );

      expect(result).toBe(false);
    });
  });

  describe('shouldShowAccountSetup redirect', () => {
    test('redirects to accountSetup when setup is required and user is logged in', async () => {
      mockUserStore.accountSetupStarted = false;
      mockUserStore.personal = { isLoggedIn: true };
      mockUserStore.selectedOrganization = null;
      mockSetupStore.shouldShowAccountSetup.mockResolvedValue(true);

      const result = await capturedGuard(
        { name: 'transactions', meta: {} },
        FROM_SAFE,
      );

      expect(result).toEqual({ name: 'accountSetup' });
    });

    test('allows navigation when setup is not required and user is logged in', async () => {
      mockUserStore.accountSetupStarted = false;
      mockUserStore.personal = { isLoggedIn: true };
      mockUserStore.selectedOrganization = null;
      mockSetupStore.shouldShowAccountSetup.mockResolvedValue(false);

      const result = await capturedGuard(
        { name: 'transactions', meta: {} },
        FROM_SAFE,
      );

      expect(result).toBe(true);
    });
  });
});
