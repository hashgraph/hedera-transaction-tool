// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import { type ITransactionFull, TransactionStatus } from '@shared/interfaces';
import TransactionDetails from '@renderer/pages/TransactionDetails/TransactionDetails.vue';
import { ToastManager } from '@renderer/utils/ToastManager.ts';

const toastManager = new ToastManager();

const { lookupMock, computeSignatureKeyMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  computeSignatureKeyMock: vi.fn().mockResolvedValue(null),
}));

const userStore = {
  selectedOrganization: {
    userId: 1,
    serverUrl: 'https://org.example.com',
    admin: false,
  },
};

const contactsStore = {
  contacts: [] as unknown[],
};

const notificationsStore = {
  currentOrganizationNotifications: [] as unknown[],
  markAsReadIds: vi.fn().mockResolvedValue(undefined),
};

const routerMock = {
  currentRoute: {
    value: {
      params: {
        id: '101',
      },
    },
  },
  back: vi.fn(),
  push: vi.fn(),
};

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  class Transaction {
    static fromBytes = vi.fn(() => new Transaction());
    _signerPublicKeys: unknown[] = [];
    transactionValidDuration = 0;
    transactionMemo = '';
    transactionId = { toString: () => 'tx-id' };
  }
  return { ...actual, Transaction };
});

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => routerMock),
  useRoute: vi.fn(() => ({ query: {} })),
  onBeforeRouteLeave: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
    mirrorNodeBaseURL: 'https://mirror.example.com',
  })),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => contactsStore),
}));

vi.mock('@renderer/stores/storeNotifications.ts', () => ({
  default: vi.fn(() => notificationsStore),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/useWebsocketSubscription', () => ({
  default: vi.fn(),
}));

vi.mock('@shared/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@shared/constants')>();
  return { ...actual, FEATURE_REVIEWER_ENABLED: true };
});

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: {
    inject: () => ({
      backendTransaction: { lookup: lookupMock },
      computeSignatureKey: computeSignatureKeyMock,
    }),
  },
}));

vi.mock('@renderer/services/organization', () => ({
  getTransactionGroupById: vi.fn(),
}));

vi.mock('@renderer/services/transactionService', () => ({
  getTransaction: vi.fn(),
}));

vi.mock('@renderer/services/transactionGroupsService', () => ({
  getGroup: vi.fn(),
}));

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionPayerId: vi.fn(() => null),
  getTransactionType: vi.fn(() => 'CRYPTO_TRANSFER'),
  getTransactionValidStart: vi.fn(() => new Date()),
}));

vi.mock('@renderer/utils', () => ({
  getAccountIdWithChecksum: vi.fn((id: string) => id),
  getAccountNicknameFromId: vi.fn(async () => null),
  getCreatorSignatureStatus: vi.fn(() => 'verified'),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  getStatusFromCode: vi.fn(() => null),
  getUInt8ArrayFromBytesString: vi.fn(() => new Uint8Array([1, 2])),
  hexToUint8Array: vi.fn(() => new Uint8Array([1, 2])),
  isLoggedInOrganization: vi.fn(() => true),
  openTransactionInHashscan: vi.fn(),
}));

vi.mock('@renderer/components/Transaction/Details/txTypeComponentMapping', () => ({
  default: {
    CRYPTO_TRANSFER: defineComponent({ template: '<div data-testid="tx-specific-stub" />' }),
  },
}));

const baseTransaction: Partial<ITransactionFull> = {
  id: 101,
  name: 'tx',
  description: '',
  transactionId: '0.0.101@123456.0001',
  type: 'CRYPTO_TRANSFER' as never,
  status: TransactionStatus.WAITING_FOR_SIGNATURES,
  statusCode: undefined,
  transactionBytes: '0102',
  creatorKeyId: 77,
  creatorEmail: 'creator@example.com',
  createdAt: new Date().toISOString(),
  validStart: new Date().toISOString(),
  mirrorNetwork: 'testnet',
  isManual: false,
  signers: [],
  observers: [],
  reviewerLists: [],
};

const makeOrgTransaction = (overrides: Partial<ITransactionFull> = {}): ITransactionFull =>
  ({
    ...baseTransaction,
    ...overrides,
  }) as ITransactionFull;

const mountTransactionDetails = async (orgTransaction: ITransactionFull) => {
  lookupMock.mockResolvedValue(orgTransaction);

  const wrapper = mount(TransactionDetails, {
    global: {
      provide: {
        [ToastManager.injectKey]: toastManager,
      },
      stubs: {
        TransactionDetailsHeader: true,
        TransactionDetailsStatusStepper: true,
        SignatureStatus: true,
        UsersGroup: true,
        ExpiringBadge: true,
        AppLoader: true,
        DateTimeString: true,
        TransactionId: true,
      },
    },
  });

  await flushPromises();

  return wrapper;
};

describe('TransactionDetails.vue review warnings', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    computeSignatureKeyMock.mockReset().mockResolvedValue(null);
    toastManager.reset();
  });

  test('shows no banner when there is no rejection and the transaction is not pending review', async () => {
    const wrapper = await mountTransactionDetails(
      makeOrgTransaction({ status: TransactionStatus.WAITING_FOR_SIGNATURES, reviewerLists: [] }),
    );

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  test('shows the awaiting-review warning when pending review with no rejections', async () => {
    const wrapper = await mountTransactionDetails(
      makeOrgTransaction({ status: TransactionStatus.READY_FOR_REVIEW, reviewerLists: [] }),
    );

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.classes()).toContain('alert-warning');
    expect(alert.text()).toContain('This transaction is awaiting review');
  });

  test('shows the in-progress rejection banner with the note when pending review and rejected', async () => {
    const wrapper = await mountTransactionDetails(
      makeOrgTransaction({
        status: TransactionStatus.READY_FOR_REVIEW,
        reviewerLists: [
          {
            id: 1,
            name: null,
            description: null,
            threshold: 1,
            members: [{ userId: 1, accepted: false, note: 'bad idea', actionedAt: null }],
          },
        ],
      }),
    );

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.classes()).toContain('alert-danger');
    expect(alert.text()).toContain('This transaction was rejected by a reviewer');

    const text = alert.find('p.text-small');
    expect(text.classes()).toContain('text-bold');

    const items = alert.findAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].text()).toBe('bad idea');

    // Only the rejection banner renders, not a separate pending-review warning.
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
  });

  test('shows the resolved-style rejection banner without a note when fully resolved', async () => {
    const wrapper = await mountTransactionDetails(
      makeOrgTransaction({
        status: TransactionStatus.EXECUTED,
        reviewerLists: [
          {
            id: 1,
            name: null,
            description: null,
            threshold: 1,
            members: [{ userId: 1, accepted: false, note: null, actionedAt: null }],
          },
        ],
      }),
    );

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.classes()).toContain('bg-danger-subtle');
    expect(alert.text()).toContain('A reviewer rejected this transaction');

    const text = alert.find('p.text-small');
    expect(text.classes()).not.toContain('text-bold');

    expect(alert.findAll('li')).toHaveLength(0);
  });

  test('only lists rejection notes that are non-empty, across multiple reviewer lists', async () => {
    const wrapper = await mountTransactionDetails(
      makeOrgTransaction({
        status: TransactionStatus.READY_FOR_REVIEW,
        reviewerLists: [
          {
            id: 1,
            name: null,
            description: null,
            threshold: 1,
            members: [
              { userId: 1, accepted: false, note: 'first note', actionedAt: null },
              { userId: 2, accepted: false, note: null, actionedAt: null },
            ],
          },
          {
            id: 2,
            name: null,
            description: null,
            threshold: 1,
            members: [{ userId: 3, accepted: false, note: 'second note', actionedAt: null }],
          },
        ],
      }),
    );

    const alert = wrapper.find('[role="alert"]');
    const items = alert.findAll('li').map(li => li.text());
    expect(items).toEqual(['first note', 'second note']);
  });
});

describe('TransactionDetails.vue review warnings - flag gating', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    computeSignatureKeyMock.mockReset().mockResolvedValue(null);
    toastManager.reset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@shared/constants');
  });

  test('hides the rejection banner when FEATURE_REVIEWER_ENABLED is off, even with a rejected reviewer', async () => {
    vi.doMock('@shared/constants', async importOriginal => {
      const actual = await importOriginal<typeof import('@shared/constants')>();
      return { ...actual, FEATURE_REVIEWER_ENABLED: false };
    });

    const { default: TransactionDetailsFlagOff } = await import(
      '@renderer/pages/TransactionDetails/TransactionDetails.vue'
    );

    lookupMock.mockResolvedValue(
      makeOrgTransaction({
        status: TransactionStatus.READY_FOR_REVIEW,
        reviewerLists: [
          {
            id: 1,
            name: null,
            description: null,
            threshold: 1,
            members: [{ userId: 1, accepted: false, note: 'bad idea', actionedAt: null }],
          },
        ],
      }),
    );

    const wrapper = mount(TransactionDetailsFlagOff, {
      global: {
        provide: {
          [ToastManager.injectKey]: toastManager,
        },
        stubs: {
          TransactionDetailsHeader: true,
          TransactionDetailsStatusStepper: true,
          SignatureStatus: true,
          UsersGroup: true,
          ExpiringBadge: true,
          AppLoader: true,
          DateTimeString: true,
          TransactionId: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
