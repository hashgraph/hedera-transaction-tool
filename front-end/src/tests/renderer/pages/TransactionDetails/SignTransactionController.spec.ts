// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import SignTransactionController from '@renderer/pages/TransactionDetails/SignTransactionController.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport.ts';
import { collectRequiredKeys, signItems } from '@renderer/utils';

/* ── ActionController stub ──────────────────────────────────────────────── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
}));

vi.mock('@renderer/components/ActionController/ActionController.vue', () => ({
  default: {
    props: ['actionCallback', 'activate'],
    setup(props: any) {
      capture.callback = props.actionCallback;
    },
    template: '<div />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const forgetTransaction = vi.fn();

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'user-id' },
    selectedOrganization: { serverUrl: 'https://org.example.com' },
  })),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: vi.fn(() => ({ backendTransaction: { forgetTransaction } })) },
}));

vi.mock('@renderer/utils/ToastManager.ts', () => ({
  ToastManager: { inject: vi.fn(() => ({ success: vi.fn(), info: vi.fn() })) },
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  collectRequiredKeys: vi.fn(() => Promise.resolve([])),
  collectMissingKeys: vi.fn(() => []),
  signItems: vi.fn(() => Promise.resolve([])),
  snapshotTransaction: (tx: object) => ({ ...tx }),
}));

/* ── Helpers ────────────────────────────────────────────────────────────── */

const makeTx = (transactionBytes: string) =>
  ({
    id: 1,
    transactionId: '0.0.1@12345.0',
    transactionBytes,
  }) as any;

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('SignTransactionController', () => {
  const callback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    capture.callback = null;
    callback.mockResolvedValue(undefined);
  });

  const mountController = (transaction: any) => {
    const wrapper = mount(SignTransactionController, {
      props: { transaction, callback, activate: false },
    });
    if (!capture.callback) throw new Error('ActionController stub did not capture actionCallback');
    return { wrapper, sign: capture.callback };
  };

  test('signs the transaction present when signing was initiated, not a swapped one', async () => {
    const reviewed = makeTx('aaaa');
    const swapped = makeTx('bbbb');
    const { wrapper, sign } = mountController(reviewed);

    // User clicks Sign
    await wrapper.setProps({ activate: true });
    // Server push replaces the transaction while the password modal is open
    await wrapper.setProps({ transaction: swapped });

    const result = await sign('password');

    expect(result).toBeNull();
    expect(collectRequiredKeys).toHaveBeenCalledTimes(1);
    const signedTransactions = vi.mocked(collectRequiredKeys).mock.calls[0][0];
    expect(signedTransactions).toHaveLength(1);
    expect(signedTransactions[0].transactionBytes).toBe('aaaa');
    expect(signItems).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(true);
  });

  test('is not affected by in-place mutation of the reactive transaction after initiation', async () => {
    const tx = makeTx('aaaa');
    const { wrapper, sign } = mountController(tx);

    await wrapper.setProps({ activate: true });
    (wrapper.props('transaction') as any).transactionBytes = 'bbbb';

    await sign('password');

    const signedTransactions = vi.mocked(collectRequiredKeys).mock.calls[0][0];
    expect(signedTransactions[0].transactionBytes).toBe('aaaa');
  });

  test('returns a bug report when there was no transaction at initiation', async () => {
    const { wrapper, sign } = mountController(null);

    await wrapper.setProps({ activate: true });
    await wrapper.setProps({ transaction: makeTx('bbbb') });

    const result = (await sign('password')) as any;

    expect(result?.status).toBe(ActionStatus.Error);
    expect(collectRequiredKeys).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });

  test('does not reuse a stale snapshot for a later signing attempt', async () => {
    const { wrapper, sign } = mountController(makeTx('aaaa'));

    await wrapper.setProps({ activate: true });
    await sign('password');
    await wrapper.setProps({ activate: false });

    await wrapper.setProps({ transaction: makeTx('cccc') });
    await wrapper.setProps({ activate: true });
    await sign('password');

    const calls = vi.mocked(collectRequiredKeys).mock.calls;
    expect(calls[1][0][0].transactionBytes).toBe('cccc');
  });
});
