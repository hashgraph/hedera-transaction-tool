// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import SetupPersonalForm from '@renderer/pages/Migrate/components/SetupPersonalForm.vue';
import { SafeStorageStatus } from '@renderer/stores/storeSafeStorage.ts';

const mocks = vi.hoisted(() => ({
  safeStorageStore: {
    status: 0, // SafeStorageStatus.notDetermined
    checkKeychain: vi.fn(),
  },
  initializeUseKeychain: vi.fn(),
  isKeychainAvailable: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock('@renderer/stores/storeSafeStorage.ts', () => ({
  default: vi.fn(() => mocks.safeStorageStore),
  SafeStorageStatus: { notDetermined: 0, denied: 1, authorized: 2 },
}));

vi.mock('@renderer/services/electronUtilsService', () => ({ relaunch: mocks.relaunch }));

vi.mock('@renderer/services/safeStorageService', () => ({
  initializeUseKeychain: mocks.initializeUseKeychain,
  isKeychainAvailable: mocks.isKeychainAvailable,
}));

const stubs = {
  AppButton: {
    inheritAttrs: false,
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppInput: true,
  AppPasswordInput: true,
  AppSeparator: true,
};

const relaunchTestId = '[data-testid="button-setup-personal-keychain-relaunch"]';

async function mountForm() {
  const wrapper = mount(SetupPersonalForm, { props: { loading: false }, global: { stubs } });
  await flushPromises();
  return wrapper;
}

describe('SetupPersonalForm keychain denial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.safeStorageStore.status = SafeStorageStatus.notDetermined;
    mocks.isKeychainAvailable.mockResolvedValue(true);
  });

  test('does not show the relaunch button before any denial', async () => {
    const wrapper = await mountForm();

    expect(wrapper.find(relaunchTestId).exists()).toBe(false);
  });

  test('offers a relaunch button once access has been denied', async () => {
    mocks.safeStorageStore.status = SafeStorageStatus.denied;

    const wrapper = await mountForm();

    expect(wrapper.text()).toContain('Keychain access was denied');
    const button = wrapper.find(relaunchTestId);
    expect(button.exists()).toBe(true);

    await button.trigger('click');
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });

  test('does not show the relaunch button when the keychain is unavailable', async () => {
    mocks.safeStorageStore.status = SafeStorageStatus.denied;
    mocks.isKeychainAvailable.mockResolvedValue(false);

    const wrapper = await mountForm();

    expect(wrapper.find(relaunchTestId).exists()).toBe(false);
  });
});
