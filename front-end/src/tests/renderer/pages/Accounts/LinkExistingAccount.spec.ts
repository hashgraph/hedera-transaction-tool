// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import LinkExistingAccount from '@renderer/pages/Accounts/LinkExistingAccount/LinkExistingAccount.vue';

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  addAccount: vi.fn(),
  accountData: {
    accountId: { value: '' },
    accountIdFormatted: { value: '0.0.1001-abcde' },
    accountInfo: { value: { balance: '10 ℏ' } },
    isValid: { value: false },
  },
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    back: mocks.routerBack,
    push: mocks.routerPush,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'local-user-id' },
  })),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
  })),
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: vi.fn(() => mocks.accountData),
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/services/accountsService', () => ({
  add: mocks.addAccount,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
      success: mocks.toastSuccess,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  formatAccountId: vi.fn((value: string) => value),
  getAccountIdWithChecksum: vi.fn((value: string) => `${value}-abcde`),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  validateAccountIdChecksum: vi.fn((value: string) => !value.includes('bad')),
}));

const stubs = {
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
  },
};

describe('LinkExistingAccount.vue', () => {
  beforeEach(() => {
    mocks.routerBack.mockReset();
    mocks.routerPush.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.addAccount.mockReset();
    mocks.accountData.accountId.value = '';
    mocks.accountData.accountIdFormatted.value = '0.0.1001-abcde';
    mocks.accountData.isValid.value = false;
  });

  test('renders account id and nickname inputs with disabled link button until account is valid', async () => {
    const wrapper = mount(LinkExistingAccount, {
      global: {
        stubs,
      },
    });

    expect(wrapper.find('[data-testid="input-existing-account-id"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Nickname');
    expect(wrapper.find('[data-testid="button-link-account-id"]').attributes('disabled')).toBeDefined();

    mocks.accountData.isValid.value = true;
    await wrapper.vm.$forceUpdate();

    expect(wrapper.find('[data-testid="button-link-account-id"]').attributes('disabled')).toBeUndefined();
  });

  test('shows invalid checksum toast and does not link account', async () => {
    mocks.accountData.accountId.value = '0.0.1001-bad';
    mocks.accountData.isValid.value = true;

    const wrapper = mount(LinkExistingAccount, {
      global: {
        stubs,
      },
    });

    await wrapper.find('form').trigger('submit');

    expect(mocks.toastError).toHaveBeenCalledWith('Invalid checksum for the entered Account ID.');
    expect(mocks.addAccount).not.toHaveBeenCalled();
  });

  test('links a valid account and routes back to accounts page', async () => {
    mocks.accountData.accountId.value = '0.0.1001-abcde';
    mocks.accountData.isValid.value = true;

    const wrapper = mount(LinkExistingAccount, {
      global: {
        stubs,
      },
    });

    await wrapper.find('form').trigger('submit');

    expect(mocks.addAccount).toHaveBeenCalledWith(
      'local-user-id',
      '0.0.1001',
      'testnet',
      '',
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Account linked successfully!');
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'accounts' });
  });
});
