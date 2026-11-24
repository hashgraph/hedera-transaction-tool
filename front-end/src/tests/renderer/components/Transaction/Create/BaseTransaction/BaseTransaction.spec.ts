// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import {
  AccountId,
  Hbar,
  Timestamp,
  Transaction,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransaction.vue';

// Module-level route query the mocked `useRoute` reads. Each test sets this
// before mounting so getInitialValidStart() sees the desired param.
let mockRouteQuery: Record<string, string | undefined> = {};
const mocks = vi.hoisted(() => ({
  loadedDraftTransaction: null as TransferTransaction | null,
  loadedDraftDescription: '',
  loadedDraftSubmitManually: undefined as boolean | undefined,
  fetchedIsManual: undefined as boolean | undefined,
  addDraft: vi.fn(),
  updateDraft: vi.fn(),
  infoControlsDescription: null as string | null,
  infoControlsDelayMs: 0,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    selectedOrganization: null,
    keyPairs: [],
    personal: { id: 'user-1', isLoggedIn: true },
  }),
}));
vi.mock('@renderer/services/transactionDraftsService', () => ({
  addDraft: mocks.addDraft,
  updateDraft: mocks.updateDraft,
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
  default: {
    name: 'TransactionHeaderControls',
    props: ['validStart', 'saveDraft', 'submitManually'],
    emits: ['update:submitManually'],
    template: '<div></div>',
  },
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
          submitManually?: boolean,
        ) => void;
      },
    ) {
      if (mocks.loadedDraftTransaction) {
        this.$emit(
          'draft-loaded',
          mocks.loadedDraftTransaction,
          mocks.loadedDraftDescription,
          mocks.loadedDraftSubmitManually,
        );
      }
    },
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue', () => ({
  default: {
    name: 'BaseGroupHandler',
    mounted(this: { $emit: (event: 'fetchedIsManual', value: boolean) => void }) {
      if (mocks.fetchedIsManual !== undefined) this.$emit('fetchedIsManual', mocks.fetchedIsManual);
    },
    template: '<div></div>',
  },
}));
vi.mock(
  '@renderer/components/Transaction/Create/BaseTransaction/BaseApproversObserverData.vue',
  () => ({ default: { name: 'BaseApproversObserverData', template: '<div></div>' } }),
);
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue', () => ({
  default: {
    name: 'BaseTransactionModal',
    props: ['hasDataChanged', 'submitManually'],
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
      transactionCtor: TransferTransaction,
      createTransaction: ({ validStart, transactionMemo, payerId }) =>
        createTransferTransaction(validStart, transactionMemo, payerId || '0.0.2'),
      getAllData: (tx: Transaction) => {
        return {
          validStart: tx.transactionId?.validStart,
          transactionMemo: tx.transactionMemo,
          payerId: tx.transactionId?.accountId || '0.0.2',
        };
      },
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

describe('BaseTransaction.vue – submit manually in drafts', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    mocks.loadedDraftTransaction = null;
    mocks.loadedDraftDescription = '';
    mocks.loadedDraftSubmitManually = undefined;
    mocks.fetchedIsManual = undefined;
    mocks.infoControlsDescription = null;
    mocks.infoControlsDelayMs = 0;
    mocks.addDraft.mockReset();
    mocks.updateDraft.mockReset();
  });

  const headerControls = (wrapper: ReturnType<typeof mountBase>) =>
    wrapper.findComponent({ name: 'TransactionHeaderControls' });

  test('restores the checkbox from a loaded draft', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(new Date(), 'memo');
    mocks.loadedDraftSubmitManually = true;

    const wrapper = mountBase();
    await flushPromises();

    expect(headerControls(wrapper).props('submitManually')).toBe(true);
  });

  test('leaves the checkbox unchecked when the loaded draft does not carry the flag', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(new Date(), 'memo');

    const wrapper = mountBase();
    await flushPromises();

    expect(headerControls(wrapper).props('submitManually')).toBe(false);
  });

  test('passes the checkbox state to the unsaved-changes modal', async () => {
    const wrapper = mountBase();
    await headerControls(wrapper).vm.$emit('update:submitManually', true);
    await flushPromises();

    expect(wrapper.findComponent({ name: 'BaseTransactionModal' }).props('submitManually')).toBe(
      true,
    );
  });

  test('saves a new draft with the checkbox state', async () => {
    const wrapper = mountBase();
    await headerControls(wrapper).vm.$emit('update:submitManually', true);
    await flushPromises();

    await (headerControls(wrapper).props('saveDraft') as () => Promise<void>)();

    expect(mocks.addDraft).toHaveBeenCalledTimes(1);
    const args = mocks.addDraft.mock.calls[0];
    expect(args[0]).toBe('user-1');
    expect(args[4]).toBe(true);
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });

  test('updates an existing draft with the checkbox state', async () => {
    mockRouteQuery = { draftId: 'draft-1' };
    const wrapper = mountBase();
    await headerControls(wrapper).vm.$emit('update:submitManually', true);
    await flushPromises();

    await (headerControls(wrapper).props('saveDraft') as () => Promise<void>)();

    expect(mocks.updateDraft).toHaveBeenCalledTimes(1);
    expect(mocks.updateDraft.mock.calls[0][0]).toBe('draft-1');
    expect(mocks.updateDraft.mock.calls[0][1]).toMatchObject({ submitManually: true });
    expect(mocks.addDraft).not.toHaveBeenCalled();
  });

  const dataChanged = (wrapper: ReturnType<typeof mountBase>) =>
    wrapper.findComponent({ name: 'BaseTransactionModal' }).props('hasDataChanged');

  test('treats a checkbox-only edit as an unsaved change and reverting it as clean', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(new Date(), 'memo');
    mocks.loadedDraftSubmitManually = false;
    const wrapper = mountBase();
    await flushPromises();
    expect(dataChanged(wrapper)).toBe(false);

    await headerControls(wrapper).vm.$emit('update:submitManually', true);
    await flushPromises();
    expect(dataChanged(wrapper)).toBe(true);

    await headerControls(wrapper).vm.$emit('update:submitManually', false);
    await flushPromises();
    expect(dataChanged(wrapper)).toBe(false);
  });

  test('a draft loaded with the checkbox checked is clean until it is changed', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(new Date(), 'memo');
    mocks.loadedDraftSubmitManually = true;
    const wrapper = mountBase();
    await flushPromises();
    expect(dataChanged(wrapper)).toBe(false);

    await headerControls(wrapper).vm.$emit('update:submitManually', false);
    await flushPromises();
    expect(dataChanged(wrapper)).toBe(true);
  });

  test('a group item fetched as manual starts with the checkbox checked and clean', async () => {
    mocks.loadedDraftTransaction = createTransferTransaction(new Date(), 'memo');
    mocks.fetchedIsManual = true;
    const wrapper = mountBase();
    await flushPromises();

    expect(headerControls(wrapper).props('submitManually')).toBe(true);
    expect(dataChanged(wrapper)).toBe(false);
  });
});
