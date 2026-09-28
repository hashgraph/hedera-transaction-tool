// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { AccountId, Hbar, Timestamp, TransactionId, TransferTransaction } from '@hiero-ledger/sdk';

// Module-level route query the mocked `useRoute` reads. Each test sets this
// before mounting so getInitialValidStart() sees the desired param.
let mockRouteQuery: Record<string, string | undefined> = {};
const mocks = vi.hoisted(() => ({
  loadedDraftTransaction: null as TransferTransaction | null,
  loadedDraftDescription: '',
  infoControlsDescription: null as string | null,
  infoControlsDelayMs: 0,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ selectedOrganization: null, keyPairs: [] }),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({
  default: () => ({ mirrorNodeBaseURL: 'http://localhost' }),
}));
vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: () => ({}),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) },
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId: ref(''),
    isValid: ref(false),
    key: ref(undefined),
  }),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: () => vi.fn(),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({ computeSignatureKey: vi.fn(async () => ({ signatureKeys: [] })) }) },
}));

// Header/Id controls run binding expressions in BaseTransaction's render, so
// keep these label helpers cheap and deterministic.
vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer'),
}));
vi.mock('@renderer/utils/transactions', () => ({
  getPropagationButtonLabel: vi.fn(() => 'Sign'),
}));

// Stub the heavy children. We read TransactionIdControls' `validStart` prop to
// see what getInitialValidStart() seeded into the reactive data. Each factory
// is inlined because vi.mock is hoisted above any module-level helper.
vi.mock('@renderer/components/Transaction/TransactionHeaderControls.vue', () => ({
  default: { name: 'TransactionHeaderControls', props: ['validStart'], template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/TransactionInfoControls.vue', () => ({
  default: {
    name: 'TransactionInfoControls',
    mounted(
      this: {
        $emit: (event: 'update:description', description: string) => void;
      },
    ) {
      if (mocks.infoControlsDescription !== null) {
        setTimeout(() => {
          this.$emit('update:description', mocks.infoControlsDescription as string);
        }, mocks.infoControlsDelayMs);
      }
    },
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/Transaction/TransactionIdControls.vue', () => ({
  default: {
    name: 'TransactionIdControls',
    props: ['validStart', 'payerId', 'maxTransactionFee'],
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue', () => ({
  default: {
    name: 'BaseDraftLoad',
    mounted(
      this: {
        $emit: (
          event: 'draft-loaded',
          tx: TransferTransaction,
          description: string,
        ) => void;
      },
    ) {
      if (mocks.loadedDraftTransaction) {
        this.$emit('draft-loaded', mocks.loadedDraftTransaction, mocks.loadedDraftDescription);
      }
    },
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue', () => ({
  default: { name: 'BaseGroupHandler', template: '<div></div>' },
}));
vi.mock(
  '@renderer/components/Transaction/Create/BaseTransaction/BaseApproversObserverData.vue',
  () => ({ default: { name: 'BaseApproversObserverData', template: '<div></div>' } }),
);
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue', () => ({
  default: {
    name: 'BaseTransactionModal',
    props: ['hasDataChanged'],
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/ui/AppInput.vue', () => ({
  default: { name: 'AppInput', template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/TransactionProcessor', () => ({
  default: { name: 'TransactionProcessor', template: '<div></div>' },
  CustomRequest: class {},
  TransactionRequest: class {},
}));

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransaction.vue';

function createTransferTransaction(validStart: Date, memo = '', payer = '0.0.2') {
  return new TransferTransaction()
    .setTransactionMemo(memo)
    .setMaxTransactionFee(new Hbar(2))
    .setTransactionId(
      TransactionId.withValidStart(AccountId.fromString(payer), Timestamp.fromDate(validStart)),
    );
}

function mountBase() {
  return mount(BaseTransaction, {
    props: {
      createTransaction: ({ validStart, transactionMemo, payerId }) =>
        createTransferTransaction(validStart, transactionMemo, payerId || '0.0.2'),
    },
  });
}

function seededValidStart(wrapper: ReturnType<typeof mountBase>): Date {
  return wrapper.findComponent({ name: 'TransactionIdControls' }).props('validStart') as Date;
}

describe('BaseTransaction.vue – initial valid start', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    mocks.loadedDraftTransaction = null;
    mocks.loadedDraftDescription = '';
    mocks.infoControlsDescription = null;
    mocks.infoControlsDelayMs = 0;
  });

  test('seeds validStart from the initialValidStart query param (epoch ms)', () => {
    mockRouteQuery = { initialValidStart: '1700000000000' };

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBe(1700000000000);
  });

  test('falls back to now when the param is absent', () => {
    const before = Date.now();

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBeGreaterThanOrEqual(before);
    expect(validStart.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('falls back to now when the param is not a number', () => {
    mockRouteQuery = { initialValidStart: 'not-a-number' };
    const before = Date.now();

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBeGreaterThanOrEqual(before);
    expect(validStart.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('keeps hasDataChanged false when leaving a freshly created form untouched', async () => {
    vi.useFakeTimers();
    const wrapper = mountBase();
    try {
      // BaseTransaction snapshots initialTransaction after mount for new forms.
      await vi.advanceTimersByTimeAsync(550);

      const hasDataChanged = wrapper
        .findComponent({ name: 'BaseTransactionModal' })
        .props('hasDataChanged');
      expect(hasDataChanged).toBe(false);
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  test('keeps hasDataChanged false after loading an existing draft and not modifying it', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(
      new Date('2026-01-02T00:00:00.000Z'),
      'loaded memo',
      '0.0.5',
    );
    mocks.loadedDraftDescription = 'loaded draft description';

    const wrapper = mountBase();
    await flushPromises();

    const hasDataChanged = wrapper
      .findComponent({ name: 'BaseTransactionModal' })
      .props('hasDataChanged');
    expect(hasDataChanged).toBe(false);
  });

  test('keeps hasDataChanged false when description arrives asynchronously from info controls', async () => {
    vi.useFakeTimers();
    mocks.loadedDraftTransaction = createTransferTransaction(
      new Date('2026-01-02T00:00:00.000Z'),
      'loaded memo',
      '0.0.5',
    );
    mocks.loadedDraftDescription = 'loaded draft description';
    mocks.infoControlsDescription = 'loaded draft description';
    mocks.infoControlsDelayMs = 25;

    const wrapper = mountBase();
    try {
      await flushPromises();

      const beforeAsyncDescription = wrapper
        .findComponent({ name: 'BaseTransactionModal' })
        .props('hasDataChanged');
      expect(beforeAsyncDescription).toBe(false);

      await vi.advanceTimersByTimeAsync(30);
      await flushPromises();

      const afterAsyncDescription = wrapper
        .findComponent({ name: 'BaseTransactionModal' })
        .props('hasDataChanged');
      expect(afterAsyncDescription).toBe(false);
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });
});
