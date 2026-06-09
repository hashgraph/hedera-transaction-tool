// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import { TransactionStatus } from '@shared/interfaces';
import type { IGroup } from '@renderer/services/organization';
import SignAllController from '@renderer/pages/TransactionGroupDetails/SignAllController.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport.ts';
import { collectRequiredKeys, collectMissingKeys, signItems } from '@renderer/utils';

/* ── ActionController stub ──────────────────────────────────────────────── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
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
    setup(props: any) {
      capture.callback = props.actionCallback;
    },
    template: '<div />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const toastSuccess = vi.fn();
const toastInfo = vi.fn();

vi.mock('vue-toast-notification', () => ({
  useToast: vi.fn(() => ({ success: toastSuccess, info: toastInfo, error: vi.fn(), warning: vi.fn() })),
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

const sigItem = (id: number) => ({ transactionId: id, transaction: {} as any, publicKeys: ['pub-key'] });
const signedItem = (id: number) => ({ transactionId: id, transaction: {} as any, publicKeys: [] });

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('SignAllController', () => {
  const mockCallback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    capture.callback = null;
    mockCallback.mockResolvedValue(undefined);
  });

  const mountAndCapture = (groupOrId: IGroup | number | null) => {
    mount(SignAllController, {
      props: { groupOrId, callback: mockCallback, activate: false },
    });
    if (!capture.callback) throw new Error('ActionController stub did not capture actionCallback');
    return capture.callback;
  };

  test('returns bug report when groupOrId is null', async () => {
    const signAll = mountAndCapture(null);
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

      const signAll = mountAndCapture(makeGroup(txs));
      await signAll(null);
      await flushPromises();

      const passedTxs: any[] = vi.mocked(collectRequiredKeys).mock.calls[0][0] as any;
      expect(passedTxs.map((t: any) => t.id)).toEqual([1, 3]);
    });
  });

  describe('early return when already fully signed', () => {
    test('shows info toast and returns null when all items are already signed', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([signedItem(1), signedItem(2)]);

      const signAll = mountAndCapture(
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

      const signAll = mountAndCapture(makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]));
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

      const signAll = mountAndCapture(makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]));
      const result = (await signAll(null)) as any;
      await flushPromises();

      expect(result?.status).toBe(ActionStatus.Error);
      expect(result?.what).toBe('2 keys are missing');
    });

    test('returns singular error report when exactly one key is missing', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1)]);
      vi.mocked(collectMissingKeys).mockReturnValue(['key-a']);

      const signAll = mountAndCapture(makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]));
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

      const signAll = mountAndCapture(
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

      const signAll = mountAndCapture(makeGroup([makeTx(1, TransactionStatus.WAITING_FOR_SIGNATURES)]));
      await signAll(null);
      await flushPromises();

      expect(toastSuccess).toHaveBeenCalledWith('Remaining 1 transaction was signed');
    });

    test('returns partial error report when some transactions are rejected', async () => {
      vi.mocked(collectRequiredKeys).mockResolvedValue([sigItem(1), sigItem(2), sigItem(3)]);
      vi.mocked(collectMissingKeys).mockReturnValue([]);
      vi.mocked(signItems).mockResolvedValue([sigItem(3)]);

      const signAll = mountAndCapture(
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

      const signAll = mountAndCapture(
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
});
