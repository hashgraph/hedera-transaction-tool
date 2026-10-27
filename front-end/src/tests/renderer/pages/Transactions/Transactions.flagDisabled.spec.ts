// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';

import Transactions from '@renderer/pages/Transactions/Transactions.vue';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';

// Separate file (rather than extra describe blocks in Transactions.spec.ts) so
// FEATURE_REVIEWER_ENABLED can be mocked false for this whole module graph without
// disturbing the FEATURE_REVIEWER_ENABLED:true mock the rest of that suite relies on.
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
  routerQuery: {} as Record<string, string>,
}));

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants');
  return { ...actual, FEATURE_REVIEWER_ENABLED: false };
});

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    currentRoute: {
      value: {
        query: mocks.routerQuery,
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
            '<div data-testid="tabs"><span v-for="item in items" :key="item.title">{{ item.title }}</span></div>',
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

describe('Transactions.vue — FEATURE_REVIEWER_ENABLED disabled', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.userStore.selectedOrganization = null;
    mocks.notificationsStore.notifications = {};
    mocks.routerQuery = { tab: 'Drafts' };
    vi.mocked(getTransactionNodes).mockReset();
    vi.mocked(getTransactionNodes).mockResolvedValue([]);
  });

  test('still shows the Ready for Review tab — only the reviewer-queue behavior is gated', () => {
    mocks.userStore.selectedOrganization = { serverUrl: 'https://org.example.com' };

    const wrapper = mountTransactions();
    const tabsText = wrapper.find('[data-testid="tabs"]').text();

    expect(tabsText).toContain('Ready for Review');
    expect(tabsText).toContain('Ready to Sign');
    expect(tabsText).toContain('In Progress');
    expect(tabsText).toContain('Ready for Execution');
    expect(tabsText).toContain('History');
  });

  test('findPrimaryTabTitle skips the reviewer-queue check and lands on Ready to Sign', async () => {
    mocks.routerQuery = {}; // no tab in the route yet -> onBeforeMount must pick a primary tab
    mocks.userStore.selectedOrganization = {
      serverUrl: 'https://org.example.com',
      isPasswordTemporary: false,
    };

    mountTransactions();
    await flushPromises();

    expect(getTransactionNodes).not.toHaveBeenCalled();
    expect(mocks.routerReplace).toHaveBeenCalledWith({ query: { tab: 'Ready to Sign' } });
  });
});
