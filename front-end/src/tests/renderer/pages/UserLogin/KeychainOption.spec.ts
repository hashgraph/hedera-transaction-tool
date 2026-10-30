// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import KeychainOption from '@renderer/pages/UserLogin/components/KeychainOption.vue';
import { SafeStorageStatus } from '@renderer/stores/storeSafeStorage.js';

const mocks = vi.hoisted(() => ({
  userStore: {
    login: vi.fn(),
    refetchOrganizations: vi.fn(),
    setAccountSetupStarted: vi.fn(),
  },
  safeStorageStore: {
    status: 0, // SafeStorageStatus.notDetermined
    checkKeychain: vi.fn(),
  },
  setupStores: vi.fn(),
  getStaticUser: vi.fn(),
  initializeUseKeychain: vi.fn(),
  isKeychainAvailable: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeSafeStorage.js', () => ({
  default: vi.fn(() => mocks.safeStorageStore),
  SafeStorageStatus: {
    notDetermined: 0,
    denied: 1,
    authorized: 2,
  },
}));

vi.mock('@renderer/composables/user/useSetupStores', () => ({
  default: vi.fn(() => mocks.setupStores),
}));

vi.mock('@renderer/services/electronUtilsService', () => ({ relaunch: mocks.relaunch }));

vi.mock('@renderer/services/safeStorageService', () => ({
  getStaticUser: mocks.getStaticUser,
  initializeUseKeychain: mocks.initializeUseKeychain,
  isKeychainAvailable: mocks.isKeychainAvailable,
}));

const stubs = {
  AppButton: {
    inheritAttrs: false,
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
};

function mountKeychainOption() {
  return mount(KeychainOption, { global: { stubs } });
}

describe('KeychainOption.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.safeStorageStore.status = SafeStorageStatus.notDetermined;
  });

  describe('button visibility (1.3.1)', () => {
    test('shows the "Sign in with Keychain" button when OS keychain is available', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);

      const wrapper = mountKeychainOption();
      await flushPromises();

      const button = wrapper.find('[data-testid="button-keychain-login"]');
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe('Sign in with Keychain');
    });

    test('hides the button when OS keychain is not available', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(false);

      const wrapper = mountKeychainOption();
      await flushPromises();

      expect(wrapper.find('[data-testid="button-keychain-login"]').exists()).toBe(false);
    });
  });

  describe('registering via OS keychain (1.3.2)', () => {
    test('registers and logs in the static user when keychain access is granted', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);
      mocks.safeStorageStore.checkKeychain.mockResolvedValue(true);
      mocks.getStaticUser.mockResolvedValue({ id: 'static-user-id', email: 'static@keychain.local' });

      const wrapper = mountKeychainOption();
      await flushPromises();

      await wrapper.find('[data-testid="button-keychain-login"]').trigger('click');
      await flushPromises();

      expect(mocks.safeStorageStore.checkKeychain).toHaveBeenCalled();
      expect(mocks.initializeUseKeychain).toHaveBeenCalledWith(true);
      expect(mocks.getStaticUser).toHaveBeenCalled();
      expect(mocks.userStore.setAccountSetupStarted).toHaveBeenCalledWith(true);
      expect(mocks.userStore.login).toHaveBeenCalledWith(
        'static-user-id',
        'static@keychain.local',
        true,
      );
      expect(mocks.userStore.refetchOrganizations).toHaveBeenCalled();
      expect(mocks.setupStores).toHaveBeenCalled();
    });

    test('does not log in when keychain access is denied', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);
      mocks.safeStorageStore.checkKeychain.mockResolvedValue(false);

      const wrapper = mountKeychainOption();
      await flushPromises();

      await wrapper.find('[data-testid="button-keychain-login"]').trigger('click');
      await flushPromises();

      expect(mocks.initializeUseKeychain).not.toHaveBeenCalled();
      expect(mocks.getStaticUser).not.toHaveBeenCalled();
      expect(mocks.userStore.login).not.toHaveBeenCalled();
    });

    test('ignores an already-initialized keychain error and still logs in', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);
      mocks.safeStorageStore.checkKeychain.mockResolvedValue(true);
      mocks.initializeUseKeychain.mockRejectedValue(new Error('Keychain mode already initialized'));
      mocks.getStaticUser.mockResolvedValue({ id: 'static-user-id', email: 'static@keychain.local' });

      const wrapper = mountKeychainOption();
      await flushPromises();

      await wrapper.find('[data-testid="button-keychain-login"]').trigger('click');
      await flushPromises();

      expect(mocks.userStore.login).toHaveBeenCalledWith(
        'static-user-id',
        'static@keychain.local',
        true,
      );
    });

    test('disables the button once safe storage access has been denied', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);
      mocks.safeStorageStore.status = SafeStorageStatus.denied;

      const wrapper = mountKeychainOption();
      await flushPromises();

      const button = wrapper.find('[data-testid="button-keychain-login"]');
      expect(button.attributes('disabled')).toBeDefined();
      expect(wrapper.text()).toContain('Sign In with Keychain is disabled.');
    });

    test('offers a relaunch button once access has been denied', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);
      mocks.safeStorageStore.status = SafeStorageStatus.denied;

      const wrapper = mountKeychainOption();
      await flushPromises();

      await wrapper.find('[data-testid="button-keychain-relaunch"]').trigger('click');

      expect(mocks.relaunch).toHaveBeenCalled();
    });

    test('does not show the relaunch button before any denial', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true);

      const wrapper = mountKeychainOption();
      await flushPromises();

      expect(wrapper.find('[data-testid="button-keychain-relaunch"]').exists()).toBe(false);
    });
  });
});
