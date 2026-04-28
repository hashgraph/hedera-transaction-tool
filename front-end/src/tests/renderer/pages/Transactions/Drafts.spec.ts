// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import Drafts from '@renderer/pages/Transactions/components/Drafts.vue';

const mocks = vi.hoisted(() => ({
  getDrafts: vi.fn(),
  getDraftsCount: vi.fn(),
  getGroups: vi.fn(),
  getGroupsCount: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    currentRoute: {
      value: {
        query: {},
      },
    },
    push: vi.fn(),
    replace: mocks.routerReplace,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'local-user-id' },
  })),
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/services/transactionDraftsService', () => ({
  deleteDraft: vi.fn(),
  getDraft: vi.fn(),
  getDrafts: mocks.getDrafts,
  getDraftsCount: mocks.getDraftsCount,
  updateDraft: vi.fn(),
}));

vi.mock('@renderer/services/transactionGroupsService', () => ({
  deleteGroup: vi.fn(),
  getGroup: vi.fn(),
  getGroups: mocks.getGroups,
  getGroupsCount: mocks.getGroupsCount,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: vi.fn(),
    })),
  },
}));

vi.mock('@renderer/utils/sdk/transactions.ts', () => ({
  getDisplayTransactionType: vi.fn(() => 'Account Create'),
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

describe('Drafts.vue', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    mocks.routerReplace.mockReset();
    mocks.getGroups.mockResolvedValue([]);
    mocks.getGroupsCount.mockResolvedValue(0);
  });

  function mountDrafts() {
    return mount(Drafts, {
      global: {
        stubs: {
          AppButton: {
            inheritAttrs: false,
            template: '<button v-bind="$attrs"><slot /></button>',
          },
          AppLoader: {
            template: '<div />',
          },
          AppPager: {
            template: '<div />',
          },
          DateTimeString: {
            props: ['date'],
            template: '<span>{{ date.toISOString() }}</span>',
          },
          EmptyTransactions: {
            props: ['mode'],
            template:
              '<div data-testid="p-empty-transaction-text">There are no Transactions at the moment.</div>',
          },
        },
      },
    });
  }

  test('shows EmptyTransactions when no drafts or groups exist', async () => {
    mocks.getDraftsCount.mockResolvedValue(0);
    mocks.getDrafts.mockResolvedValue([]);

    const wrapper = mountDrafts();
    await flushPromises();

    expect(wrapper.find('[data-testid="p-empty-transaction-text"]').text()).toContain(
      'There are no Transactions at the moment.',
    );
  });

  test('renders draft table headers, rows, and actions', async () => {
    mocks.getDraftsCount.mockResolvedValue(2);
    mocks.getDrafts.mockResolvedValue([
      {
        id: 'draft-b',
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        type: 'Account Create',
        description: 'B draft sort',
        isTemplate: false,
        transactionBytes: '',
      },
      {
        id: 'draft-a',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        type: 'Account Create',
        description: 'A draft sort',
        isTemplate: true,
        transactionBytes: '',
      },
    ]);

    const wrapper = mountDrafts();
    await flushPromises();

    const headerText = wrapper.find('thead').text();
    expect(headerText).toContain('Date Created');
    expect(headerText).toContain('Transaction Type');
    expect(headerText).toContain('Description');
    expect(headerText).toContain('Is Template');
    expect(headerText).toContain('Actions');

    expect(wrapper.find('[data-testid="span-draft-tx-type-0"]').text()).toBe('Account Create');
    // Default sort is created_at desc → newer draft-b (2026-01-02) first.
    expect(wrapper.find('[data-testid="span-draft-tx-description-0"]').text()).toBe(
      'B draft sort',
    );
    expect(wrapper.find('[data-testid="checkbox-is-template-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-draft-delete-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-draft-continue-0"]').exists()).toBe(true);

    await wrapper.find('thead th:nth-child(3) .table-sort-link').trigger('click');

    // Clicking description header sorts asc → 'A draft sort' first.
    expect(wrapper.find('[data-testid="span-draft-tx-description-0"]').text()).toBe(
      'A draft sort',
    );
  });
});
