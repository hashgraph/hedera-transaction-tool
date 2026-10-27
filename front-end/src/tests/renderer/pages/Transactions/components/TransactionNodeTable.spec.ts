// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import TransactionNodeTable from '@renderer/pages/Transactions/components/TransactionNodeTable.vue';
import { TransactionNodeCollection, type ITransactionNode } from '@shared/interfaces/ITransactionNode.ts';
import { TransactionStatus } from '@shared/interfaces';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';
import { BackEndTransactionType, NotificationType } from '@shared/interfaces';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';

vi.mock('@shared/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@shared/constants')>();
  return { ...actual, FEATURE_REVIEWER_ENABLED: true };
});

const routerMock = {
  currentRoute: {
    value: {
      query: {},
    },
  },
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => routerMock),
}));

const userStore = {
  selectedOrganization: {
    serverUrl: 'https://org.example.com',
  },
};

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: vi.fn(() => userStore),
}));

vi.mock('@renderer/stores/storeNetwork.ts', () => ({
  default: vi.fn(() => ({ network: 'testnet' })),
}));

vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({
    routeDown: vi.fn(),
  })),
}));

vi.mock('@renderer/composables/useMarkNotifications', () => ({
  default: vi.fn(() => ({ oldNotifications: [] })),
}));

vi.mock('@renderer/composables/useWebsocketSubscription', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useTransactionLiveHighlight', async () => {
  const { ref } = await import('vue');
  return {
    useTransactionLiveHighlight: vi.fn(() => ({
      recentlyUpdatedTxIds: ref(new Set()),
      recentlyUpdatedGroupIds: ref(new Set()),
      highlightAndFetch: vi.fn(),
    })),
  };
});

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: {
    inject: () => ({
      backendTransaction: {
        forget: vi.fn(),
      },
    }),
  },
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: vi.fn(),
      success: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
    isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
  };
});

vi.mock('@renderer/services/organization/transactionNode.ts', () => ({
  getTransactionNodes: vi.fn(async () => []),
}));

const PendingReviewFieldV2Stub = defineComponent({
  name: 'PendingReviewFieldV2',
  props: { pendingReviewFilter: { type: Array, default: () => [] } },
  emits: ['update:pendingReviewFilter'],
  template:
    '<button data-testid="pending-review-toggle" @click="$emit(\'update:pendingReviewFilter\', [\'PENDING_REVIEW\'])" />',
});

const TransactionNodeRowStub = defineComponent({
  name: 'TransactionNodeRow',
  props: { node: { type: Object, required: true }, index: Number, collection: String },
  template:
    '<tr class="node-row" :data-testid="`row-${node.transactionId ?? node.groupId}`" :data-status="node.status" />',
});

const AppPagerStub = defineComponent({
  name: 'AppPager',
  props: { totalItems: Number, currentPage: Number, perPage: Number },
  template: '<div data-testid="pager" :data-total="totalItems" />',
});

const node = (overrides: Partial<ITransactionNode> & { transactionId: number }): ITransactionNode => ({
  description: '',
  createdAt: '2030-01-01T00:00:00Z',
  validStart: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  ...overrides,
});

const mountTable = (collection: TransactionNodeCollection) =>
  mount(TransactionNodeTable, {
    props: { collection },
    global: {
      stubs: {
        TransactionNodeHead: true,
        AppLoader: true,
        EmptyTransactions: true,
        TransactionsFilterV2: true,
        PendingReviewFieldV2: PendingReviewFieldV2Stub,
        TransactionNodeRow: TransactionNodeRowStub,
        AppPager: AppPagerStub,
      },
    },
  });

describe('TransactionNodeTable.vue — pending review visibility', () => {
  beforeEach(() => {
    vi.mocked(getTransactionNodes).mockReset();
    localStorage.clear();
  });

  test('hides READY_FOR_REVIEW nodes from Ready To Sign by default', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([
      node({ transactionId: 1, status: TransactionStatus.READY_FOR_REVIEW }),
      node({ transactionId: 2, status: TransactionStatus.WAITING_FOR_SIGNATURES }),
    ]);

    const wrapper = mountTable(TransactionNodeCollection.READY_TO_SIGN);
    await flushPromises();

    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="row-2"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="pager"]').attributes('data-total')).toBe('1');
  });

  test('reveals READY_FOR_REVIEW nodes once the pending-review filter is toggled on', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([
      node({ transactionId: 1, status: TransactionStatus.READY_FOR_REVIEW }),
      node({ transactionId: 2, status: TransactionStatus.WAITING_FOR_SIGNATURES }),
    ]);

    const wrapper = mountTable(TransactionNodeCollection.READY_TO_SIGN);
    await flushPromises();

    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(false);

    await wrapper.get('[data-testid="pending-review-toggle"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="row-2"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="pager"]').attributes('data-total')).toBe('2');
  });

  test('remembers the pending-review toggle across remounts', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([
      node({ transactionId: 1, status: TransactionStatus.READY_FOR_REVIEW }),
    ]);

    const first = mountTable(TransactionNodeCollection.READY_TO_SIGN);
    await flushPromises();
    await first.get('[data-testid="pending-review-toggle"]').trigger('click');
    await flushPromises();
    first.unmount();

    const second = mountTable(TransactionNodeCollection.READY_TO_SIGN);
    await flushPromises();
    expect(second.find('[data-testid="row-1"]').exists()).toBe(true);
  });

  test('restores stored history filters and ignores invalid stored values', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([]);
    const key = (n: string) => `${n}::https://org.example.com:${TransactionNodeCollection.HISTORY}`;
    localStorage.setItem(key('status-filter'), JSON.stringify([TransactionStatus.EXECUTED, 'bogus']));

    mountTable(TransactionNodeCollection.HISTORY);
    await flushPromises();

    const args = vi.mocked(getTransactionNodes).mock.calls[0];
    expect(args.flat(2)).toContainEqual(TransactionStatus.EXECUTED);
    expect(args.flat(2)).not.toContain('bogus');
  });

  test('marks review notifications read on the Ready for Review tab', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([]);
    vi.mocked(useMarkNotifications).mockClear();

    mountTable(TransactionNodeCollection.READY_FOR_REVIEW);
    await flushPromises();

    expect(useMarkNotifications).toHaveBeenCalledWith([
      NotificationType.TRANSACTION_INDICATOR_REVIEW,
    ]);
  });

  test('restores the stored transaction-type filter', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([]);
    localStorage.setItem(
      `type-filter::https://org.example.com:${TransactionNodeCollection.HISTORY}`,
      JSON.stringify([BackEndTransactionType.ACCOUNT_CREATE, 'bogus']),
    );

    mountTable(TransactionNodeCollection.HISTORY);
    await flushPromises();

    const args = vi.mocked(getTransactionNodes).mock.calls[0].flat(2);
    expect(args).toContainEqual(BackEndTransactionType.ACCOUNT_CREATE);
    expect(args).not.toContain('bogus');
  });

  test('does not hide READY_FOR_REVIEW nodes outside the Ready To Sign collection', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([
      node({ transactionId: 1, status: TransactionStatus.READY_FOR_REVIEW }),
    ]);

    const wrapper = mountTable(TransactionNodeCollection.IN_PROGRESS);
    await flushPromises();

    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pending-review-toggle"]').exists()).toBe(false);
  });

  test('does not render the pending-review filter outside Ready To Sign', async () => {
    vi.mocked(getTransactionNodes).mockResolvedValue([]);

    const wrapper = mountTable(TransactionNodeCollection.HISTORY);
    await flushPromises();

    expect(wrapper.find('[data-testid="pending-review-toggle"]').exists()).toBe(false);
  });
});

describe('TransactionNodeTable.vue — pending review filter gated by FEATURE_REVIEWER_ENABLED', () => {
  test('does not render the filter on Ready To Sign when the flag is disabled', async () => {
    vi.resetModules();
    vi.doMock('@shared/constants', async importOriginal => {
      const actual = await importOriginal<typeof import('@shared/constants')>();
      return { ...actual, FEATURE_REVIEWER_ENABLED: false };
    });

    const { default: TransactionNodeTableFlagOff } = await import(
      '@renderer/pages/Transactions/components/TransactionNodeTable.vue'
    );
    vi.mocked(getTransactionNodes).mockResolvedValue([
      node({ transactionId: 1, status: TransactionStatus.READY_FOR_REVIEW }),
    ]);

    const wrapper = mount(TransactionNodeTableFlagOff, {
      props: { collection: TransactionNodeCollection.READY_TO_SIGN },
      global: {
        stubs: {
          TransactionNodeHead: true,
          AppLoader: true,
          EmptyTransactions: true,
          TransactionsFilterV2: true,
          PendingReviewFieldV2: PendingReviewFieldV2Stub,
          TransactionNodeRow: TransactionNodeRowStub,
          AppPager: AppPagerStub,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="pending-review-toggle"]').exists()).toBe(false);
    // With no opt-in control available, the READY_FOR_REVIEW node stays hidden.
    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(false);

    vi.doUnmock('@shared/constants');
  });
});
