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
import { applyNanoOffset } from '@renderer/utils/sdk/timestamp';
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
  routeDown: vi.fn(),
  processed: null as { bytesFactory?: (nanoOffset: number) => Uint8Array } | null,
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
  default: () => ({ routeDown: mocks.routeDown }),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) },
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId: ref('0.0.2'),
    isValid: ref(false),
    key: ref(undefined),
  }),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: () => vi.fn(async (fn: () => Promise<unknown>) => fn()),
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
    mounted(this: { $emit: (event: 'update:description', description: string) => void }) {
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
  default: {
    name: 'TransactionProcessor',
    props: ['onExecuted', 'onSubmitted', 'onGroupSubmitted', 'onLocalStored'],
    methods: {
      process(req: { bytesFactory?: (nanoOffset: number) => Uint8Array }) {
        mocks.processed = req;
      },
    },
    template: '<div></div>',
  },
  CustomRequest: class {},
  TransactionRequest: { fromData: (opts: object) => opts },
}));

// Mirrors the real builders: the id is set once here, which locks it, and the
// nano offset is applied before that (a second setTransactionId would throw).
function createTransferTransaction(
  validStart: Date,
  memo = '',
  payer = '0.0.2',
  validStartNanoOffset = 0,
) {
  return new TransferTransaction()
    .setTransactionMemo(memo)
    .setMaxTransactionFee(new Hbar(2))
    .setTransactionId(
      TransactionId.withValidStart(
        AccountId.fromString(payer),
        applyNanoOffset(Timestamp.fromDate(validStart), validStartNanoOffset),
      ),
    );
}

function mountBase() {
  return mount(BaseTransaction, {
    props: {
      transactionCtor: TransferTransaction,
      createTransaction: ({ validStart, transactionMemo, payerId, validStartNanoOffset }) =>
        createTransferTransaction(
          validStart,
          transactionMemo,
          payerId || '0.0.2',
          validStartNanoOffset,
        ),
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

describe('BaseTransaction.vue – routing after submit carries the real transaction id', () => {
  beforeEach(() => {
    mockRouteQuery = {};
    mocks.loadedDraftTransaction = null;
    mocks.loadedDraftDescription = '';
    mocks.infoControlsDescription = null;
    mocks.infoControlsDelayMs = 0;
    mocks.routeDown.mockClear();
    mocks.processed = null;
  });

  test('handleSubmit passes the SDK transactionId alongside the DB id', async () => {
    const wrapper = mountBase();
    await flushPromises();

    const onSubmitted = wrapper
      .findComponent({ name: 'TransactionProcessor' })
      .props('onSubmitted');
    await onSubmitted(93, 'deadbeef');

    expect(mocks.routeDown).toHaveBeenCalledTimes(1);
    const [targetNodeId, collection] = mocks.routeDown.mock.calls[0];
    expect(targetNodeId.transactionId).toBe(93);
    expect(targetNodeId.sdkTransactionId).toMatch(/^0\.0\.2@\d+\.\d+$/);
    expect(collection).toEqual([targetNodeId]);
  });

  test('handleSubmit and handleLocalStored use the id of the last bytes built by bytesFactory (duplicate retry)', async () => {
    const wrapper = mountBase();
    await flushPromises();
    await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();

    const bytesFactory = mocks.processed!.bytesFactory!;
    const initial = Transaction.fromBytes(bytesFactory(0)).transactionId!;
    const retried = Transaction.fromBytes(bytesFactory(7)).transactionId!;
    const retriedId = retried.toString();
    expect(retriedId).not.toBe(initial.toString());
    // Retries are exact nano offsets from the first attempt's validStart
    expect(retried.accountId?.toString()).toBe(initial.accountId?.toString());
    expect(retried.validStart!.seconds.toString()).toBe(initial.validStart!.seconds.toString());
    expect(retried.validStart!.nanos.toNumber() - initial.validStart!.nanos.toNumber()).toBe(7);

    const processor = wrapper.findComponent({ name: 'TransactionProcessor' });
    await processor.props('onSubmitted')(93, 'deadbeef');
    await processor.props('onLocalStored')('local-uuid-1');

    expect(mocks.routeDown.mock.calls[0][0].sdkTransactionId).toBe(retriedId);
    expect(mocks.routeDown.mock.calls[1][0].sdkTransactionId).toBe(retriedId);
  });

  test('routes with the id of the submitted bytes even if the form validStart ticks afterwards', async () => {
    const wrapper = mountBase();
    await flushPromises();
    await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();

    const submittedId = Transaction.fromBytes(mocks.processed!.bytesFactory!(0)).transactionId!;

    // The running-clock picker rewrites validStart every second, which gives
    // the `transaction` computed a new id while signing/submitting is in flight.
    const laterValidStart = new Date(submittedId.validStart!.toDate().getTime() + 5000);
    wrapper
      .findComponent({ name: 'TransactionIdControls' })
      .vm.$emit('update:validStart', laterValidStart);
    await flushPromises();

    const processor = wrapper.findComponent({ name: 'TransactionProcessor' });
    await processor.props('onSubmitted')(93, 'deadbeef');
    await processor.props('onLocalStored')('local-uuid-1');

    expect(mocks.routeDown.mock.calls[0][0].sdkTransactionId).toBe(submittedId.toString());
    expect(mocks.routeDown.mock.calls[1][0].sdkTransactionId).toBe(submittedId.toString());
  });

  test('handleLocalStored passes the SDK transactionId alongside the local id', async () => {
    const wrapper = mountBase();
    await flushPromises();

    const onLocalStored = wrapper
      .findComponent({ name: 'TransactionProcessor' })
      .props('onLocalStored');
    await onLocalStored('local-uuid-1');

    expect(mocks.routeDown).toHaveBeenCalledTimes(1);
    const [targetNodeId] = mocks.routeDown.mock.calls[0];
    expect(targetNodeId.transactionId).toBe('local-uuid-1');
    expect(targetNodeId.sdkTransactionId).toMatch(/^0\.0\.2@\d+\.\d+$/);
  });

  test('handleGroupSubmit does not carry a single-transaction sdkTransactionId', async () => {
    const wrapper = mountBase();
    await flushPromises();

    const onGroupSubmitted = wrapper
      .findComponent({ name: 'TransactionProcessor' })
      .props('onGroupSubmitted');
    await onGroupSubmitted(55);

    expect(mocks.routeDown).toHaveBeenCalledTimes(1);
    const [targetNodeId] = mocks.routeDown.mock.calls[0];
    expect(targetNodeId).toEqual({ groupId: 55 });
  });
});
