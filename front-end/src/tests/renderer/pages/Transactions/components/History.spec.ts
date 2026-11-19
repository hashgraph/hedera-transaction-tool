// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import History from '@renderer/pages/Transactions/components/History.vue';
import { TransactionNodeCollection } from '@shared/interfaces/ITransactionNode.ts';
import type { ITransaction } from '@shared/interfaces';
import type { Transaction as PrismaTransaction } from '@prisma/client';

const { routeDownMock, isLoggedInOrgMock } = vi.hoisted(() => ({
  routeDownMock: vi.fn(),
  isLoggedInOrgMock: vi.fn(() => true),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  class Transaction {
    static fromBytes = vi.fn(() => new Transaction());
  }
  return { ...actual, Transaction };
});

const routerMock = { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } };
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => routerMock),
}));

const userStoreOrg = {
  personal: { id: 1 },
  selectedOrganization: { serverUrl: 'https://org.example.com', isPasswordTemporary: false },
};
const userStoreLocal = {
  personal: { id: 1 },
  selectedOrganization: null,
};
let userStore: typeof userStoreOrg | typeof userStoreLocal = userStoreOrg;

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => userStore),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ network: 'testnet' })),
}));
vi.mock('@renderer/stores/storeNotifications', () => ({
  default: vi.fn(() => ({ notifications: {} })),
}));
vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({ routeDown: routeDownMock })),
}));

vi.mock('@renderer/composables/useMarkNotifications', () => ({
  default: vi.fn(() => ({ oldNotifications: ref([]) })),
}));
vi.mock('@renderer/composables/useWebsocketSubscription', () => ({
  default: vi.fn(),
}));
vi.mock('@renderer/composables/useTransactionLiveHighlight', () => ({
  useTransactionLiveHighlight: vi.fn(() => ({
    recentlyUpdatedTxIds: ref(new Set()),
    highlightAndFetch: vi.fn(),
  })),
}));
vi.mock('@renderer/composables/useTableQueryState.ts', () => ({
  default: vi.fn(() => ({
    page: ref(1),
    pageSize: ref(10),
    sortField: ref('created_at'),
    sortDirection: ref('desc'),
    syncToUrl: vi.fn(),
  })),
}));

const { getTransactionsMock, getTransactionsCountMock, getHistoryTransactionsMock } = vi.hoisted(
  () => ({
    getTransactionsMock: vi.fn(async (): Promise<PrismaTransaction[]> => []),
    getTransactionsCountMock: vi.fn(async () => 0),
    getHistoryTransactionsMock: vi.fn(
      async (): Promise<{ totalItems: number; items: ITransaction[] }> => ({
        totalItems: 0,
        items: [],
      }),
    ),
  }),
);

vi.mock('@renderer/services/transactionService', () => ({
  getTransactions: getTransactionsMock,
  getTransactionsCount: getTransactionsCountMock,
}));
vi.mock('@renderer/services/organization', () => ({
  getHistoryTransactions: getHistoryTransactionsMock,
}));

vi.mock('@renderer/utils', () => ({
  getTransactionStatus: vi.fn(() => 'EXECUTED'),
  getStatusFromCode: vi.fn(() => null),
  getNotifiedTransactions: vi.fn(() => []),
  hexToUint8Array: vi.fn(() => new Uint8Array([1, 2])),
  isLoggedInOrganization: isLoggedInOrgMock,
  isUserLoggedIn: vi.fn(() => true),
}));
vi.mock('@renderer/utils/sdk/transactions', () => ({
  getDisplayTransactionType: vi.fn(() => 'CRYPTO_TRANSFER'),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({ backendTransaction: { forget: vi.fn() } }) },
}));

const AppButtonStub = defineComponent({
  name: 'AppButton',
  inheritAttrs: false,
  emits: ['click'],
  template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
});

const mountHistory = () =>
  mount(History, {
    global: {
      stubs: {
        AppButton: AppButtonStub,
        AppLoader: true,
        AppPager: true,
        EmptyTransactions: true,
        TransactionsFilter: true,
        DateTimeString: true,
        TransactionId: true,
      },
    },
  });

const orgTransaction = (overrides: Partial<ITransaction> = {}): ITransaction =>
  ({
    id: 201,
    transactionId: '0.0.201@1700000000.000000001',
    description: '',
    statusCode: 0,
    createdAt: new Date().toISOString(),
    transactionBytes: '0102',
    ...overrides,
  }) as ITransaction;

describe('History.vue — routing to details carries the real transaction id', () => {
  beforeEach(() => {
    routeDownMock.mockClear();
    getTransactionsMock.mockReset().mockResolvedValue([]);
    getTransactionsCountMock.mockReset().mockResolvedValue(0);
    getHistoryTransactionsMock.mockReset().mockResolvedValue({ totalItems: 0, items: [] });
  });

  test('passes the real transactionId alongside the DB id for an organization transaction', async () => {
    userStore = userStoreOrg;
    isLoggedInOrgMock.mockReturnValue(true);
    getHistoryTransactionsMock.mockResolvedValue({
      totalItems: 1,
      items: [orgTransaction()],
    });

    const wrapper = mountHistory();
    await flushPromises();

    await wrapper.get('[data-testid="button-transaction-details-0"]').trigger('click');
    await flushPromises();

    expect(routeDownMock).toHaveBeenCalledTimes(1);
    const [current, nodeIds, , collection] = routeDownMock.mock.calls[0];
    expect(current).toEqual({
      transactionId: 201,
      sdkTransactionId: '0.0.201@1700000000.000000001',
    });
    expect(nodeIds).toEqual([current]);
    expect(collection).toBe(TransactionNodeCollection.HISTORY);
  });

  test('passes the real transactionId alongside the local id for a local transaction', async () => {
    userStore = userStoreLocal;
    isLoggedInOrgMock.mockReturnValue(false);
    const localTx = {
      id: 'local-uuid-1',
      transaction_id: '0.0.5@1700000000.000000002',
      description: '',
      status_code: 0,
      created_at: new Date(),
      type: 'CRYPTOTRANSFER',
      body: '0102',
    } as unknown as PrismaTransaction;
    getTransactionsMock.mockResolvedValue([localTx]);
    getTransactionsCountMock.mockResolvedValue(1);

    const wrapper = mountHistory();
    await flushPromises();

    await wrapper.get('[data-testid="button-transaction-details-0"]').trigger('click');
    await flushPromises();

    expect(routeDownMock).toHaveBeenCalledTimes(1);
    const [current] = routeDownMock.mock.calls[0];
    expect(current).toEqual({
      transactionId: 'local-uuid-1',
      sdkTransactionId: '0.0.5@1700000000.000000002',
    });
  });
});
