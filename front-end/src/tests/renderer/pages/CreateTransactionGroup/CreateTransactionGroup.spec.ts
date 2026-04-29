// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import CreateTransactionGroup from '@renderer/pages/CreateTransactionGroup/CreateTransactionGroup.vue';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  transactionGroupStore: {
    description: '',
    groupItems: [] as any[],
    groupValidStart: new Date('2026-01-01T00:00:00.000Z'),
    sequential: false,
    clearGroup: vi.fn(),
    duplicateGroupItem: vi.fn(),
    fetchGroup: vi.fn(),
    getRequiredKeys: vi.fn(() => []),
    isModified: vi.fn(() => false),
    removeGroupItem: vi.fn(),
    saveGroup: vi.fn(),
    setModified: vi.fn(),
    updateTransactionValidStarts: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRoute: vi.fn(() => ({
    query: {},
  })),
  useRouter: vi.fn(() => ({
    previousTab: 'Drafts',
    push: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    keyPairs: [],
    personal: { id: 'local-user-id' },
    selectedOrganization: null,
  })),
}));

vi.mock('@renderer/stores/storeTransactionGroup', () => ({
  default: vi.fn(() => mocks.transactionGroupStore),
}));

vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({
    routeDown: vi.fn(),
  })),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/user/useDateTimeSetting.ts', () => ({
  default: vi.fn(() => ({
    dateTimeSettingLabel: 'UTC Time',
  })),
}));

vi.mock('@renderer/services/transactionGroupsService', () => ({
  deleteGroup: vi.fn(),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  assertUserLoggedIn: vi.fn(),
  formatHbarTransfers: vi.fn(() => ''),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  getPropagationButtonLabel: vi.fn(() => 'Sign and Submit'),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  redirectToPreviousTransactionsTab: vi.fn(),
}));

vi.mock('@renderer/utils/sdk', () => ({
  createTransactionId: vi.fn(() => '0.0.1@1.1'),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    KeyList: class KeyList {},
    PublicKey: {
      fromString: vi.fn(),
    },
    Transaction: {
      fromBytes: vi.fn(() => ({ transactionMemo: '' })),
    },
    TransferTransaction: class TransferTransaction {},
  };
});

describe('CreateTransactionGroup.vue', () => {
  beforeEach(() => {
    mocks.toastError.mockReset();
    mocks.transactionGroupStore.description = '';
    mocks.transactionGroupStore.groupItems = [];
    mocks.transactionGroupStore.clearGroup.mockReset();
    mocks.transactionGroupStore.setModified.mockReset();
    mocks.transactionGroupStore.updateTransactionValidStarts.mockReset();
  });

  function mountCreateTransactionGroup(errorHandler?: (error: unknown) => void) {
    return mount(CreateTransactionGroup, {
      global: {
        config: {
          errorHandler,
        },
        stubs: {
          AppButton: {
            inheritAttrs: false,
            props: ['disabled', 'type'],
            template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
          },
          AppCheckBox: {
            emits: ['update:checked'],
            inheritAttrs: false,
            props: ['checked'],
            template:
              '<input v-bind="$attrs" type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
          },
          AppInput: {
            emits: ['update:modelValue'],
            inheritAttrs: false,
            props: ['modelValue'],
            template:
              '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          AppModal: {
            inheritAttrs: false,
            props: ['show'],
            template: '<div v-if="show" v-bind="$attrs"><slot /></div>',
          },
          EmptyTransactions: {
            template:
              '<div data-testid="p-empty-transaction-text">There are no Transactions at the moment.</div>',
          },
          ImportCSVController: {
            template: '<div />',
          },
          RunningClockDatePicker: {
            template: '<div />',
          },
          SaveTransactionGroupModal: {
            template: '<div />',
          },
          TransactionGroupProcessor: {
            template: '<div />',
          },
          TransactionSelectionModal: {
            template: '<div />',
          },
        },
      },
    });
  }

  test('shows empty group state and disables Sign and Submit when no transactions exist', () => {
    const wrapper = mountCreateTransactionGroup();

    expect(wrapper.find('[data-testid="p-empty-transaction-text"]').text()).toContain(
      'There are no Transactions at the moment.',
    );
    expect(wrapper.find('[data-testid="button-sign-submit"]').attributes('disabled')).toBeDefined();
  });

  test('shows validation toast when submitting with blank group description', async () => {
    mocks.transactionGroupStore.groupItems = [
      {
        description: 'transaction',
        payerAccountId: '0.0.2',
        transactionBytes: new Uint8Array([1]),
        type: 'Account Create',
        validStart: new Date(),
      },
    ];

    const wrapper = mountCreateTransactionGroup();
    await wrapper.find('[data-testid="button-sign-submit"]').trigger('click');

    expect(mocks.toastError).toHaveBeenCalledWith('Group Description Required');
  });

  test('throws save validation when group description is blank', async () => {
    const errors: unknown[] = [];
    mocks.transactionGroupStore.groupItems = [
      {
        description: 'transaction',
        payerAccountId: '0.0.2',
        transactionBytes: new Uint8Array([1]),
        type: 'Account Create',
        validStart: new Date(),
      },
    ];

    const wrapper = mountCreateTransactionGroup(error => errors.push(error));
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(errors[0]).toMatchObject({
      message: 'Please enter a group description',
    });
    expect(mocks.transactionGroupStore.saveGroup).not.toHaveBeenCalled();
  });

  test('throws save validation when a group has zero transactions', async () => {
    const errors: unknown[] = [];

    const wrapper = mountCreateTransactionGroup(error => errors.push(error));
    await wrapper
      .find('[data-testid="input-transaction-group-description"]')
      .setValue('group without transactions');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(errors[0]).toMatchObject({
      message: 'Please add at least one transaction to the group',
    });
    expect(mocks.transactionGroupStore.saveGroup).not.toHaveBeenCalled();
  });

  test('clears transactions after confirming Delete All', async () => {
    mocks.transactionGroupStore.groupItems = [
      {
        description: 'transaction',
        payerAccountId: '0.0.2',
        transactionBytes: new Uint8Array([1]),
        type: 'Account Create',
        validStart: new Date(),
      },
    ];

    const wrapper = mountCreateTransactionGroup();
    await wrapper.find('[data-testid="button-delete-all"]').trigger('click');
    await wrapper.find('[data-testid="button-confirm-delete-all"]').trigger('click');

    expect(mocks.transactionGroupStore.clearGroup).toHaveBeenCalled();
  });
});
