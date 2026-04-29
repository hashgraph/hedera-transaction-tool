// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';

import Accounts from '@renderer/pages/Accounts/Accounts.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  toastSuccess: vi.fn(),
  getAllAccounts: vi.fn(),
  removeAccounts: vi.fn(),
  changeNickname: vi.fn(),
  accountData: {
    accountId: { value: '' },
    accountIdFormatted: { value: '0.0.1001' },
    accountIdWithChecksum: { value: ['0.0.1001', 'abcde'] },
    accountInfo: {
      value: {
        autoRenewPeriod: 7776000,
        balance: {},
        createdTimestamp: '2026-01-01T00:00:00.000Z',
        declineReward: false,
        deleted: false,
        ethereumNonce: 3,
        evmAddress: '1234567890abcdef',
        expiryTimestamp: '2026-12-31T00:00:00.000Z',
        maxAutomaticTokenAssociations: 12,
        memo: 'account memo',
        receiverSignatureRequired: true,
      },
    },
    autoRenewPeriodInDays: { value: 90 },
    isValid: { value: true },
    key: { value: null as unknown },
    getFormattedPendingRewards: vi.fn(() => '1 ℏ'),
    getStakedToString: vi.fn(() => 'Node 3'),
    openAccountInHashscan: vi.fn(),
  },
  networkStore: {
    currentRate: null,
    network: 'testnet',
  },
  userStore: {
    personal: { id: 'local-user-id' },
  },
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mocks.routerPush,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => mocks.networkStore),
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: vi.fn(() => mocks.accountData),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/services/accountsService', () => ({
  changeNickname: mocks.changeNickname,
  getAll: mocks.getAllAccounts,
  remove: mocks.removeAccounts,
}));

vi.mock('@renderer/services/keyPairService', () => ({
  getKeyListLevels: vi.fn(() => 2),
}));

vi.mock('@renderer/services/mirrorNodeDataService', () => ({
  getDollarAmount: vi.fn(() => '$1.00'),
}));

vi.mock('@renderer/caches/backend/PublicKeyOwnerCache.ts', () => {
  class PublicKeyOwnerCache {
    static inject = vi.fn(() => ({
      lookup: vi.fn(async () => null),
    }));

    lookup = vi.fn(async () => null);
  }

  return {
    PublicKeyOwnerCache,
  };
});

vi.mock('@renderer/components/Transaction/Create/txTypeComponentMapping', () => ({
  transactionTypeKeys: {
    createAccount: 'AccountCreateTransaction',
    deleteAccount: 'AccountDeleteTransaction',
    updateAccount: 'AccountUpdateTransaction',
  },
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  extractIdentifier: vi.fn(() => null),
  formatPublicKey: vi.fn(async (key: string) => key),
  getAccountIdWithChecksum: vi.fn((accountId: string) => `${accountId}-abcde`),
  getFormattedDateFromTimestamp: vi.fn(() => 'Jan 1, 2026'),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  stringifyHbar: vi.fn(() => '10 ℏ'),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  class Hbar {}
  class KeyList {}
  class PublicKey {
    _key = { _type: 'ED25519' };
    toStringRaw() {
      return 'public-key-raw';
    }
  }

  return { ...actual, Hbar, KeyList, PublicKey };
});

const AppInputStub = defineComponent({
  emits: ['blur'],
  setup(_props, { emit, expose }) {
    const inputRef = ref<HTMLInputElement | null>(null);
    expose({ inputRef });
    return { emit, inputRef };
  },
  template: '<input ref="inputRef" v-bind="$attrs" @blur="emit(\'blur\', $event)" />',
});

const stubs = {
  AppButton: {
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppCheckBox: {
    props: ['checked'],
    template:
      '<input v-bind="$attrs" type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
  },
  AppCustomIcon: {
    template: '<div />',
  },
  AppInput: AppInputStub,
  AppModal: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
  KeyStructureModal: {
    props: ['show'],
    template: '<div v-if="show" data-testid="key-structure-modal" />',
  },
  Transition: false,
};

const accounts = [
  {
    account_id: '0.0.1001',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    nickname: 'Primary Account',
  },
  {
    account_id: '0.0.1002',
    created_at: new Date('2026-01-02T00:00:00.000Z'),
    nickname: 'Secondary Account',
  },
];

describe('Accounts.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.removeAccounts.mockReset();
    mocks.changeNickname.mockReset();
    mocks.getAllAccounts.mockReset();
    mocks.getAllAccounts.mockResolvedValue(accounts);
    mocks.accountData.accountId.value = '';
    mocks.accountData.accountIdFormatted.value = '0.0.1001';
    mocks.accountData.accountIdWithChecksum.value = ['0.0.1001', 'abcde'];
    mocks.accountData.isValid.value = true;
    mocks.accountData.key.value = null;
    mocks.accountData.accountInfo.value.deleted = false;
  });

  function mountAccounts() {
    return mount(Accounts, {
      global: {
        mocks: {
          $router: {
            push: mocks.routerPush,
          },
        },
        stubs,
      },
    });
  }

  test('renders accounts, add-new routes, and account details', async () => {
    const wrapper = mountAccounts();
    await flushPromises();

    expect(wrapper.find('[data-testid="p-account-nickname-0"]').text()).toBe('Primary Account');
    expect(wrapper.find('[data-testid="p-account-id-0"]').text()).toContain('0.0.1001');
    expect(wrapper.find('[data-testid="link-create-new-account"]').text()).toBe('Create New');
    expect(wrapper.find('[data-testid="link-add-existing-account"]').text()).toBe('Add Existing');
    expect(wrapper.find('[data-testid="p-account-data-account-id"]').text()).toContain('0.0.1001');
    expect(wrapper.find('[data-testid="p-account-data-evm-address"]').text()).toContain(
      '1234567890abcdef',
    );
    expect(wrapper.find('[data-testid="p-account-data-balance"]').text()).toContain('10 ℏ');
    expect(wrapper.find('[data-testid="p-account-data-memo"]').text()).toBe('account memo');
    expect(wrapper.find('[data-testid="p-account-data-max-auto-association"]').text()).toBe('12');
    expect(wrapper.find('[data-testid="p-account-data-eth-nonce"]').text()).toBe('3');
    expect(wrapper.find('[data-testid="p-account-data-staked-to"]').text()).toBe('Node 3');
    expect(wrapper.find('[data-testid="p-account-data-pending-reward"]').text()).toBe('1 ℏ');
    expect(wrapper.find('[data-testid="p-account-data-rewards"]').text()).toBe('Accepted');

    await wrapper.find('[data-testid="link-create-new-account"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'AccountCreateTransaction' },
    });

    await wrapper.find('[data-testid="link-add-existing-account"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith('accounts/link-existing');
  });

  test('sort menu refetches accounts with selected sort order', async () => {
    const wrapper = mountAccounts();
    await flushPromises();

    await wrapper.find('[data-testid="menu-sort-account-id-asc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { account_id: 'asc' } }),
    );

    await wrapper.find('[data-testid="menu-sort-account-nickname-desc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { nickname: 'desc' } }),
    );

    await wrapper.find('[data-testid="menu-sort-account-date-added-asc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { created_at: 'asc' } }),
    );
  });

  test('select mode shows checkboxes and opens unlink modal for selected accounts', async () => {
    const wrapper = mountAccounts();
    await flushPromises();

    await wrapper.find('[data-testid="button-select-many-accounts"]').trigger('click');

    expect(wrapper.find('[data-testid="checkbox-multiple-account-id-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-remove-multiple-accounts"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="checkbox-multiple-account-id-0"]').setValue(true);
    expect(wrapper.find('[data-testid="button-remove-multiple-accounts"]').attributes('disabled')).toBeUndefined();

    await wrapper.find('[data-testid="button-remove-multiple-accounts"]').trigger('click');
    expect(wrapper.text()).toContain('Unlink account');
  });

  test('routes account edit actions and opens remove confirmation', async () => {
    const wrapper = mountAccounts();
    await flushPromises();

    await wrapper.find('[data-testid="button-delete-from-network"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'AccountDeleteTransaction' },
      query: { accountId: '0.0.1001' },
    });

    await wrapper.find('[data-testid="button-update-in-network"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'AccountUpdateTransaction' },
      query: { accountId: '0.0.1001' },
    });

    await wrapper.find('[data-testid="button-remove-account-card"]').trigger('click');
    expect(wrapper.find('[data-testid="button-confirm-unlink-account"]').exists()).toBe(true);
  });

  test('shows complex key details and deleted account warning', async () => {
    const { KeyList } = await import('@hiero-ledger/sdk');
    mocks.accountData.key.value = new KeyList();
    mocks.accountData.accountInfo.value.deleted = true;

    const wrapper = mountAccounts();
    await flushPromises();

    expect(wrapper.text()).toContain('Complex Key');
    const seeDetails = wrapper.findAll('.link-primary').find(element => element.text() === 'See details');
    expect(seeDetails).toBeTruthy();
    await seeDetails!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="key-structure-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-account-is-deleted"]').text()).toBe('Account is deleted');
  });

  test('edits selected account nickname on blur', async () => {
    const wrapper = mountAccounts();
    await flushPromises();

    await wrapper.find('[data-testid="button-edit-selected-account-nickname"]').trigger('click');
    await flushPromises();

    const input = wrapper.find('[data-testid="input-account-nickname"]');
    expect(input.exists()).toBe(true);
    (input.element as HTMLInputElement).value = 'Renamed Account';
    await input.trigger('blur');
    await flushPromises();

    expect(mocks.changeNickname).toHaveBeenCalledWith(
      'local-user-id',
      '0.0.1001',
      'Renamed Account',
    );
  });
});
