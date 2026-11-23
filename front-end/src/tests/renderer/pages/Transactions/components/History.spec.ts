// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import History from '@renderer/pages/Transactions/components/History.vue';
import { getHistoryTransactions } from '@renderer/services/organization';

const SERVER_URL = 'https://org.example.com';
const SDK_ID = '0.0.2@1700000000.000000000';

const mocks = vi.hoisted(() => ({
  forget: vi.fn(),
  websocketCallback: null as null | ((payload?: unknown) => Promise<void>),
  userStore: { personal: { isLoggedIn: true, id: 'u1' }, selectedOrganization: null as any },
}));

vi.mock('vue-router', () => ({ useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })) }));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: vi.fn(() => ({ network: 'testnet' })) }));
vi.mock('@renderer/stores/storeNotifications', () => ({
  default: vi.fn(() => ({ notifications: {} })),
}));
vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({ routeDown: vi.fn() })),
}));

vi.mock('@renderer/composables/useMarkNotifications', () => ({
  default: vi.fn(() => ({ oldNotifications: ref([]) })),
}));
vi.mock('@renderer/composables/useWebsocketSubscription', () => ({
  default: vi.fn((_event: string, cb: (payload?: unknown) => Promise<void>) => {
    mocks.websocketCallback = cb;
  }),
}));
vi.mock('@renderer/composables/useTransactionLiveHighlight', () => ({
  useTransactionLiveHighlight: vi.fn(() => ({
    recentlyUpdatedTxIds: ref(new Set()),
    recentlyUpdatedGroupIds: ref(new Set()),
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

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({ backendTransaction: { forget: mocks.forget } }) },
}));

vi.mock('@renderer/services/organization', () => ({ getHistoryTransactions: vi.fn() }));
vi.mock('@renderer/services/transactionService', () => ({
  getTransactions: vi.fn(async () => []),
  getTransactionsCount: vi.fn(async () => 0),
}));

vi.mock('@hiero-ledger/sdk', async () => {
  const actual = await vi.importActual<typeof import('@hiero-ledger/sdk')>('@hiero-ledger/sdk');
  class Transaction {
    static fromBytes = vi.fn(() => new Transaction());
  }
  return { ...actual, Transaction };
});

vi.mock('@renderer/utils', () => ({
  getTransactionStatus: vi.fn(() => 'EXECUTED'),
  getStatusFromCode: vi.fn(() => 'SUCCESS'),
  getNotifiedTransactions: vi.fn(() => []),
  hexToUint8Array: vi.fn(() => new Uint8Array()),
  isLoggedInOrganization: vi.fn((o: unknown) => o !== null),
  isUserLoggedIn: vi.fn(() => true),
}));
vi.mock('@renderer/utils/sdk/transactions', () => ({
  getDisplayTransactionType: vi.fn(() => 'Transfer'),
}));

const mountHistory = () =>
  mount(History, {
    global: {
      stubs: {
        AppButton: true,
        AppLoader: true,
        AppPager: true,
        EmptyTransactions: true,
        TransactionsFilter: true,
        DateTimeString: true,
        TransactionId: true,
      },
    },
  });

describe('History.vue — cache invalidation', () => {
  beforeEach(() => {
    mocks.forget.mockReset();
    mocks.websocketCallback = null;
    mocks.userStore.selectedOrganization = { serverUrl: SERVER_URL, isPasswordTemporary: false };
    vi.mocked(getHistoryTransactions).mockReset().mockResolvedValue({
      totalItems: 2,
      items: [
        { id: 5, transactionId: SDK_ID, transactionBytes: '' },
        { id: 6, transactionId: '0.0.2@1700000001.000000000', transactionBytes: '' },
      ],
    } as never);
  });

  test('forgets displayed transactions by database id (not SDK id) on a legacy notification', async () => {
    mountHistory();
    await flushPromises();

    await mocks.websocketCallback!();
    await flushPromises();

    expect(mocks.forget).toHaveBeenCalledTimes(2);
    expect(mocks.forget).toHaveBeenCalledWith(5, SERVER_URL);
    expect(mocks.forget).toHaveBeenCalledWith(6, SERVER_URL);
    expect(mocks.forget).not.toHaveBeenCalledWith(SDK_ID, SERVER_URL);
  });

  test('forgets before refetching', async () => {
    mountHistory();
    await flushPromises();
    vi.mocked(getHistoryTransactions).mockClear();

    await mocks.websocketCallback!();

    expect(mocks.forget.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getHistoryTransactions).mock.invocationCallOrder[0],
    );
  });
});
