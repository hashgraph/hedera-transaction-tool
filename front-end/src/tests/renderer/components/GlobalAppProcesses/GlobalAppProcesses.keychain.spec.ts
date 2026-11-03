// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import GlobalAppProcesses from '@renderer/components/GlobalAppProcesses/GlobalAppProcesses.vue';
import useSafeStorage from '@renderer/stores/storeSafeStorage';

const mocks = vi.hoisted(() => ({
  userStore: {},
  refetchOrganizations: vi.fn(),
  tryAutoLogin: vi.fn(),
  setupStores: vi.fn(),
  selectDefaultOrganization: vi.fn(),
  redirectIfRequiredKeysToMigrate: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/composables/useAutoLogin', () => ({ default: () => mocks.tryAutoLogin }));
vi.mock('@renderer/composables/useLoader', () => ({
  default: () => async (fn: () => Promise<unknown>) => await fn(),
}));
vi.mock('@renderer/composables/user/useSetupStores', () => ({ default: () => mocks.setupStores }));
vi.mock('@renderer/composables/user/useDefaultOrganization', () => ({
  default: () => ({ select: mocks.selectDefaultOrganization }),
}));
vi.mock('@renderer/composables/useRecoveryPhraseHashMigrate', () => ({
  default: () => ({ redirectIfRequiredKeysToMigrate: mocks.redirectIfRequiredKeysToMigrate }),
}));
vi.mock('@renderer/composables/useAppVisibility', () => ({ default: vi.fn() }));
vi.mock('@renderer/services/safeStorageService', () => ({ getUseKeychain: vi.fn(async () => true) }));
vi.mock('@renderer/services/userService', () => ({
  getUsersCount: vi.fn(async () => 1),
  resetDataLocal: vi.fn(),
}));
vi.mock('@renderer/services/claimService', () => ({ getStoredClaim: vi.fn(async () => undefined) }));

const ImportantNote = defineComponent({
  emits: ['ready'],
  setup: (_, { emit, expose }) => {
    expose({ initialize: () => emit('ready') });
    return () => null;
  },
  mounted() {
    this.$emit('ready');
  },
});
const BeginDataMigration = defineComponent({
  emits: ['ready', 'migrate:start'],
  setup: (_, { expose }) => {
    expose({ initialize: () => undefined });
    return () => null;
  },
  mounted() {
    this.$emit('ready');
  },
});

const mountComponent = () =>
  mount(GlobalAppProcesses, {
    global: {
      stubs: {
        ImportantNote,
        BeginDataMigration,
        AutoLoginInOrganization: true,
        MandatoryUpgrade: true,
        OptionalUpgrade: true,
        KeychainUnavailableModal: true,
      },
    },
  });

describe('GlobalAppProcesses keychain gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    mocks.userStore = reactive({
      personal: null,
      refetchOrganizations: mocks.refetchOrganizations,
    });
    mocks.redirectIfRequiredKeysToMigrate.mockResolvedValue(false);
  });

  test('skips org refetch and store setup when the keychain is unavailable', async () => {
    mocks.tryAutoLogin.mockImplementation(async () => {
      useSafeStorage().keychainUnavailable = true;
    });

    mountComponent();
    await flushPromises();

    expect(mocks.tryAutoLogin).toHaveBeenCalled();
    expect(mocks.refetchOrganizations).not.toHaveBeenCalled();
    expect(mocks.selectDefaultOrganization).not.toHaveBeenCalled();
    expect(mocks.setupStores).not.toHaveBeenCalled();
  });

  test('continues with org refetch and store setup when the keychain works', async () => {
    mocks.tryAutoLogin.mockResolvedValue(undefined);

    mountComponent();
    await flushPromises();

    expect(mocks.refetchOrganizations).toHaveBeenCalled();
    expect(mocks.setupStores).toHaveBeenCalled();
  });
});
