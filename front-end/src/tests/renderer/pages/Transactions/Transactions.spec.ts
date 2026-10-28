// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import Transactions from '@renderer/pages/Transactions/Transactions.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  importTransactionFile: vi.fn(),
  userStore: {
    selectedOrganization: null as any,
  },
  notificationsStore: {
    notifications: {} as Record<string, any[]>,
  },
}));

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants');
  return { ...actual, FEATURE_REVIEWER_ENABLED: true };
});

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    currentRoute: {
      value: {
        query: {
          tab: 'Drafts',
        },
      },
    },
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
  })),
}));

vi.mock('@renderer/stores/storeNotifications', () => ({
  default: vi.fn(() => mocks.notificationsStore),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: vi.fn(() => async (callback: () => Promise<void>) => callback()),
}));

vi.mock('@renderer/services/organization/transactionNode.ts', () => ({
  getTransactionNodes: vi.fn(async () => []),
}));

vi.mock('@renderer/services/transactionFileService.ts', () => ({
  importTransactionFile: mocks.importTransactionFile,
}));

vi.mock('@renderer/services/organization', () => ({
  importSignatures: vi.fn(),
}));

vi.mock('@renderer/caches/backend/BackendTransactionCache.ts', () => {
  class BackendTransactionCache {
    static inject = vi.fn(() => ({
      lookup: vi.fn(),
    }));

    lookup = vi.fn();
  }

  return {
    BackendTransactionCache,
  };
});

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: vi.fn(),
      success: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
  hexToUint8Array: vi.fn(() => new Uint8Array()),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  isOrganizationActive: vi.fn((organization: unknown) => organization !== null),
}));

describe('Transactions.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.importTransactionFile.mockResolvedValue({
      kind: 'tx2', suggestedName: 'transactions.tx2', transactionFile: { network: 'testnet', items: [] },
    });
    mocks.userStore.selectedOrganization = null;
    mocks.notificationsStore.notifications = {};
  });

  function mountTransactions() {
    return mount(Transactions, {
      global: {
        mocks: {
          $router: {
            push: mocks.routerPush,
          },
        },
        stubs: {
          AppButton: {
            template: '<button><slot /></button>',
          },
          AppDropDown: {
            props: ['items'],
            template:
              '<div data-testid="button-more-dropdown-sm"><button v-for="item in items" :key="item.value" :data-testid="`dropdown-item-${item.value}`" @click="$emit(\'select\', item.value)">{{ item.label }}</button></div>',
          },
          AppTabs: {
            props: ['items'],
            template:
              '<div data-testid="tabs"><span v-for="item in items" :key="item.title">{{ item.title }}<b v-if="item.notifications" :data-testid="`badge-${item.title}`">{{ item.notifications }}</b></span></div>',
          },
          Drafts: {
            template: '<div data-testid="drafts-tab" />',
          },
          ExportTransactionsModal: {
            template: '<div />',
          },
          History: {
            template: '<div />',
          },
          SignTransactionFileModal: {
            template: '<div data-testid="sign-transaction-file-modal" />',
          },
          TransactionImportModal: {
            template: '<div />',
          },
          TransactionNodeTable: {
            template: '<div />',
          },
          TransactionSelectionModal: {
            template: '<div data-testid="transaction-selection-modal" />',
          },
        },
      },
    });
  }

  test('shows personal transaction tabs and Create New dropdown options', () => {
    const wrapper = mountTransactions();

    expect(wrapper.find('[data-testid="tabs"]').text()).toContain('Drafts');
    expect(wrapper.find('[data-testid="tabs"]').text()).toContain('History');
    expect(wrapper.find('[data-testid="span-single-transaction"]').text()).toBe('Transaction');
    expect(wrapper.find('[data-testid="span-group-transaction"]').text()).toBe(
      'Transaction Group',
    );
  });

  test('counts review notifications on the Ready for Review tab only', () => {
    mocks.userStore.selectedOrganization = { serverUrl: 'https://org.example' };
    const review = (network: string) => ({
      notification: { type: 'TRANSACTION_INDICATOR_REVIEW', additionalData: { network } },
    });
    mocks.notificationsStore.notifications = {
      'https://org.example': [review('testnet'), review('testnet'), review('mainnet')],
    };

    const wrapper = mountTransactions();

    expect(wrapper.get('[data-testid="badge-Ready for Review"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="badge-Ready to Sign"]').exists()).toBe(false);
  });

  test('opens transaction selection modal from the Create New menu', async () => {
    const wrapper = mountTransactions();

    await wrapper.find('[data-testid="span-single-transaction"]').trigger('click');

    expect(wrapper.find('[data-testid="transaction-selection-modal"]').exists()).toBe(true);
  });

  test('routes Transaction Group menu item to create-transaction-group', async () => {
    const wrapper = mountTransactions();

    await wrapper.find('[data-testid="span-group-transaction"]').trigger('click');

    expect(mocks.routerPush).toHaveBeenCalledWith('create-transaction-group');
  });

  test('opens sign transaction file modal after selecting a transaction file', async () => {
    const wrapper = mountTransactions();

    await wrapper.find('[data-testid="dropdown-item-signTransactionFile"]').trigger('click');

    expect(mocks.importTransactionFile).toHaveBeenCalledWith(true);
    expect(wrapper.find('[data-testid="sign-transaction-file-modal"]').exists()).toBe(true);
  });

  test('shows organization transaction tabs and import signatures action in organization mode', () => {
    mocks.userStore.selectedOrganization = {
      serverUrl: 'https://org.example.com',
    };

    const wrapper = mountTransactions();
    const tabsText = wrapper.find('[data-testid="tabs"]').text();

    expect(tabsText).toContain('Ready for Review');
    expect(tabsText).toContain('Ready to Sign');
    expect(tabsText).toContain('In Progress');
    expect(tabsText).toContain('Ready for Execution');
    expect(tabsText).toContain('History');
    expect(wrapper.find('[data-testid="dropdown-item-importSignaturesFromFile"]').exists()).toBe(
      true,
    );
  });
});
