// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import ImportUserData from '@renderer/pages/Migrate/components/ImportUserData.vue';

const mocks = vi.hoisted(() => ({
  migrateUserData: vi.fn(),
  setup: vi.fn(),
  user: { personal: { id: 'personal-id', isLoggedIn: true } },
}));

vi.mock('@renderer/services/migrateDataService', () => ({
  migrateUserData: mocks.migrateUserData,
}));
vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({ setup: mocks.setup }) }));

const RESULT = {
  accountsImported: 2,
  publicKeysImported: 1,
  defaultMaxTransactionFee: null,
  currentNetwork: 'mainnet',
};

describe('Migrate: import user data step', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.personal = { id: 'personal-id', isLoggedIn: true };
    mocks.migrateUserData.mockResolvedValue(RESULT);
  });

  test('imports the TTv1 accounts and settings for the logged in user', async () => {
    mount(ImportUserData);
    await flushPromises();

    expect(mocks.migrateUserData).toHaveBeenCalledWith('personal-id');
  });

  test('switches the app to the network read from the TTv1 settings', async () => {
    mount(ImportUserData);
    await flushPromises();

    expect(mocks.setup).toHaveBeenCalledWith('mainnet');
  });

  test('reports the import result to the wizard', async () => {
    const wrapper = mount(ImportUserData);
    await flushPromises();

    expect(wrapper.emitted('importedUserData')).toEqual([[RESULT]]);
  });
});
