// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { reactive } from 'vue';
import { mount } from '@vue/test-utils';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';

const mocks = vi.hoisted(() => ({
  userStore: {},
  refetchOrganizations: vi.fn(),
  tryAutoSignIn: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeOrganizationConnection', () => ({
  default: vi.fn(() => ({ getConnectionStatus: vi.fn(() => 'connected') })),
}));
vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: () => ({ getPassword: vi.fn(() => null), passwordModalOpened: vi.fn(() => false) }),
}));
vi.mock('@renderer/composables/useVersionCheck', () => ({
  default: () => ({ performInitialVersionCheck: vi.fn() }),
}));
vi.mock('@renderer/services/organizationCredentials', () => ({
  tryAutoSignIn: mocks.tryAutoSignIn,
}));

const mountComponent = () =>
  mount(AutoLoginInOrganization, {
    global: { stubs: { AppModal: true, AppButton: true } },
  });

describe('AutoLoginInOrganization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.userStore = reactive({
      personal: { isLoggedIn: true, id: 'user-1', useKeychain: true },
      organizations: [
        { id: 'org-1', nickname: 'Org', isServerActive: true, loginRequired: true, isLoading: false },
      ],
      refetchOrganizations: mocks.refetchOrganizations,
    });
  });

  test('propagates sign-in errors', async () => {
    mocks.tryAutoSignIn.mockRejectedValue(new Error('boom'));
    const wrapper = mountComponent();

    await expect(wrapper.vm.triggerReauthentication()).rejects.toThrow('boom');
    expect(mocks.refetchOrganizations).not.toHaveBeenCalled();
  });

  test('refetches organizations after a successful sign in', async () => {
    mocks.tryAutoSignIn.mockResolvedValue([]);
    const wrapper = mountComponent();

    await wrapper.vm.triggerReauthentication();

    expect(mocks.refetchOrganizations).toHaveBeenCalled();
  });
});
