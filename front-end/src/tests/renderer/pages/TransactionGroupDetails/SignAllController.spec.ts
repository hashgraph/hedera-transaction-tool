// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import { TransactionStatus } from '@shared/interfaces';
import type { IGroup } from '@renderer/services/organization';
import SignAllController from '@renderer/pages/TransactionGroupDetails/SignAllController.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport.ts';
import { collectRequiredKeys, collectMissingKeys, signItems } from '@renderer/utils';
import { getTransactionGroupById } from '@renderer/services/organization';

/* ── ActionController stub ──────────────────────────────────────────────── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
  emit: null as ((event: string, ...args: unknown[]) => void) | null,
}));

vi.mock('@renderer/components/ActionController/ActionController.vue', () => ({
  default: {
    props: [
      'actionCallback',
      'activate',
      'progressText',
      'progressTitle',
      'confirmTitle',
      'confirmText',
      'actionButtonText',
      'cancelButtonText',
      'dataTestid',
      'progressIconName',
      'personalPasswordRequired',
    ],
    setup(props: any, { emit }: any) {
      capture.callback = props.actionCallback;
      capture.emit = emit;
    },
    template: '<div />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const toastSuccess = vi.fn();
const toastInfo = vi.fn();

vi.mock('vue-toast-notification', () => ({
  useToast: vi.fn(() => ({
    success: toastSuccess,
    info: toastInfo,
    error: vi.fn(),
    warning: vi.fn(),
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({ selectedOrganization: { serverUrl: 'https://org.example.com' } })),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: vi.fn(() => ({})) },
}));

vi.mock('@renderer/utils/ToastManager.ts', () => ({
  ToastManager: { inject: vi.fn(() => ({ success: toastSuccess, info: toastInfo })) },
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  collectRequiredKeys: vi.fn(),
  collectMissingKeys: vi.fn(() => []),
  signItems: vi.fn(() => Promise.resolve([])),
  snapshotGroup: (group: { groupItems: object[] }) => ({
    ...group,
    groupItems: group.groupItems.map(item => ({ ...item })),
  }),
}));

vi.mock('@renderer/services/organization', () => ({
  getTransactionGroupById: vi.fn(),
}));

/* ── Helpers ────────────────────────────────────────────────────────────── */

const makeTx = (id: number, status: TransactionStatus) =>
  ({
    id,
    status,
    transactionId: `0.0.${id}@12345.0`,
    transactionBytes: '0102',
    validStart: new Date().toISOString(),
    type: 'TRANSFER',
  }) as any;

const makeGroup = (txs: ReturnType<typeof makeTx>[]): IGroup => ({
  id: 1,
  description: 'Test group',
  atomic: false,
  sequential: false,
  createdAt: new Date().toISOString(),
  groupValidStart: new Date().toISOString(),
  groupItems: txs.map((tx, i) => ({ seq: i + 1, transactionId: tx.id, transaction: tx })),
});

const sigItem = (id: number) => ({
  transactionId: id,
  transaction: {} as any,
  publicKeys: ['pub-key'],
});
const signedItem = (id: number) => ({ transactionId: id, transaction: {} as any, publicKeys: [] });

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('SignAllController', () => {
  const mockCallback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    capture.callback = null;
    mockCallback.mockResolvedValue(undefined);
  });

  const mountController = (groupOrId: IGroup | number | null) => {
    const wrapper = mount(SignAllController, {
      props: { groupOrId, callback: mockCallback, activate: false },
    });
    if (!capture.callback) throw new Error('ActionController stub did not capture actionCallback');
    return { wrapper, signAll: capture.callback };
  };

  // Mounts and simulates the user clicking Sign All
  const mountAndCapture = async (groupOrId: IGroup | number | null) => {
    const { wrapper, signAll } = mountController(groupOrId);
    await wrapper.setProps({ activate: true });
    return signAll;
  };

  test('returns bug report when groupOrId is null', async () => {
    const signAll = await mountAndCapture(null);
    const result = (await signAll(null)) as any;

    expect(result?.status).toBe(ActionStatus.Error);
    expect(result?.title).toBe('Sign All');
  });

  describe('status filtering', () => {
    test('passes only WAITING_FOR_SIGNATURES and WAITING_FOR_EXECUTION transactions to collectRequiredKeys', async () => {
      const txs = [
        makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES),
        makeTx(2, TransactionStatus.EXECUTED),
        makeTx(3, TransactionStatus.WAITING_FOR_EXECUTION),
        makeTx(4, TransactionStatus.EXPIRED),
        makeTx(5, TransactionStatus.CANCELED),
      ];
      vi.mocked(collectRequiredKeys).mockResolvedValue([signedItem(1), signedItem(3)]);

      const signAll = await mountAndCapture(makeGroup(txs));
      await signAll(null);
      await flushPromises();

      const passedTxs: any[] = vi.mocked(collectRequiredKeys).mock.calls[0][0] as any;
      expect(passedTxs.map((t: any) => t.id)).toEqual([1, 3]);
    });
  });

  describe('early return when already fully signed', () => {
    test('shows info toast and returns null when all items are already signed', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([signedItem(1), signedItem(2)]);

      const signAll = await mountAndCapture(
        makeGroup([
          makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES),
          makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES),
        ]),
      );
      const result = await signAll(null);
      await flushPromises();

      expect(toastInfo).toHaveBeenCalledWith('All transactions are already signed');
      expect(result).toBeNull();
    });

    test('does not call collectMissingKeys or signItems when remainingCount is 0', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([signedItem(1)]);

      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );
      await signAll(null);
      await flushPromises();

      expect(collectMissingKeys).not.toHaveBeenCalled();
      expect(signItems).not.toHaveBeenCalled();
    });
  });

  describe('missing keys', () => {
    test('returns error report listing the count when multiple keys are missing', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(collectMissingKeys).mockReturnValue(['key-a', 'key-b']);

      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );
      const result = (await signAll(null)) as any;
      await flushPromises();

      expect(result?.status).toBe(ActionStatus.Error);
      expect(result?.what).toBe('2 keys are missing');
    });

    test('returns singular error report when exactly one key is missing', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(collectMissingKeys).mockReturnValue(['key-a']);

      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );
      const result = (await signAll(null)) as any;
      await flushPromises();

      expect(result?.status).toBe(ActionStatus.Error);
      expect(result?.what).toBe('Key is missing');
    });
  });

  describe('signing outcomes', () => {
    test('shows plural success toast and returns null when multiple transactions are signed', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1), sigItem(2)]);
      vi.mocked(collectMissingKeys).mockReturnValue([]);
      vi.mocked(signItems).mockResolvedValue([]);

      const signAll = await mountAndCapture(
        makeGroup([
          makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES),
          makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES),
        ]),
      );
      const result = await signAll(null);
      await flushPromises();

      expect(toastSuccess).toHaveBeenCalledWith('Remaining 2 transactions were signed');
      expect(result).toBeNull();
    });

    test('shows singular success toast when exactly one transaction is signed', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(collectMissingKeys).mockReturnValue([]);
      vi.mocked(signItems).mockResolvedValue([]);

      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );
      await signAll(null);
      await flushPromises();

      expect(toastSuccess).toHaveBeenCalledWith('Remaining 1 transaction was signed');
    });

    test('returns partial error report when some transactions are rejected', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1), sigItem(2), sigItem(3)]);
      vi.mocked(collectMissingKeys).mockReturnValue([]);
      vi.mocked(signItems).mockResolvedValue([sigItem(3)]);

      const signAll = await mountAndCapture(
        makeGroup([
          makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES),
          makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES),
          makeTx(3, TransactionStatus.WAITING_FOR_SIGNATURES),
        ]),
      );
      const result = (await signAll(null)) as any;
      await flushPromises();

      expect(result?.status).toBe(ActionStatus.Error);
      expect(result?.what).toContain('2 transactions signed');
      expect(result?.what).toContain('1 transactions were not signed');
    });

    test('returns full rejection error report when all transactions are rejected', async () => {
      const items = [sigItem(1), sigItem(2)];
      vi.mocked(collectRequiredKeys).mockResolvedValue(items);
      vi.mocked(collectMissingKeys).mockReturnValue([]);
      vi.mocked(signItems).mockResolvedValue(items);

      const signAll = await mountAndCapture(
        makeGroup([
          makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES),
          makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES),
        ]),
      );
      const result = (await signAll(null)) as any;
      await flushPromises();

      expect(result?.status).toBe(ActionStatus.Error);
      expect(result?.what).toBe('Transactions were not signed');
    });
  });

  describe('group target', () => {
    const txIdsSigned = () => vi.mocked(collectRequiredKeys).mock.calls[0][0].map((t: any) => t.id);

    test('signs the group held by the prop when signing starts', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(signItems).mockResolvedValue([]);
      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );

      const result = await signAll(null);

      expect(result).toBeNull();
      expect(getTransactionGroupById).not.toHaveBeenCalled();
      expect(txIdsSigned()).toEqual([1]);
      expect(mockCallback).toHaveBeenCalledWith(1, true);
    });

    test('signs the prop value even if it was replaced before activation', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(2)]);
      const { wrapper, signAll } = mountController(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );

      await wrapper.setProps({
        groupOrId: makeGroup([makeTx(2, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      });
      await wrapper.setProps({ activate: true });
      await signAll(null);

      expect(txIdsSigned()).toEqual([2]);
    });

    test('fetches the group when only an id was provided', async () => {
      vi.mocked(getTransactionGroupById).mockResolvedValue(
        makeGroup([makeTx(5, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(5)]);
      vi.mocked(signItems).mockResolvedValue([]);
      const signAll = await mountAndCapture(7);

      const result = await signAll(null);

      expect(result).toBeNull();
      expect(getTransactionGroupById).toHaveBeenCalledWith('https://org.example.com', 7);
      expect(txIdsSigned()).toEqual([5]);
      expect(mockCallback).toHaveBeenCalledWith(7, true);
    });

    test('reports failure to the callback when signing is rejected', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(signItems).mockResolvedValueOnce([sigItem(1)]);
      const signAll = await mountAndCapture(
        makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]),
      );

      await signAll(null);

      expect(mockCallback).toHaveBeenCalledWith(1, false);
    });

    test('forwards activate updates from the action controller', () => {
      const { wrapper } = mountController(null);

      capture.emit!('update:activate', true);

      expect(wrapper.emitted('update:activate')).toEqual([[true]]);
    });
  });
});
