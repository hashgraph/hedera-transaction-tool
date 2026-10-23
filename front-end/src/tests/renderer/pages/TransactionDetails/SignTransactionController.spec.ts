// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import SignTransactionController from '@renderer/pages/TransactionDetails/SignTransactionController.vue';
import { collectMissingKeys, collectRequiredKeys, signItems } from '@renderer/utils';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport.ts';

/* ── ActionController stub ──────────────────────────────────────────────── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
  emit: null as ((event: string, ...args: unknown[]) => void) | null,
  toastSuccess: vi.fn(),
}));

vi.mock('@renderer/components/ActionController/ActionController.vue', () => ({
  default: {
    props: ['actionCallback', 'activate'],
    setup(props: any, { emit }: any) {
      capture.callback = props.actionCallback;
      capture.emit = emit;
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
  ToastManager: { inject: vi.fn(() => ({ success: capture.toastSuccess, info: vi.fn() })) },
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
    capture.emit = null;
    callback.mockResolvedValue(undefined);
  });

  const mountController = (transaction: any) => {
    const wrapper = mount(SignTransactionController, {
      props: { transaction, callback, activate: false },
    });
    if (!capture.callback) throw new Error('ActionController stub did not capture actionCallback');
    return { wrapper, sign: capture.callback };
  };

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

  test('signs the transaction held by the prop when signing starts', async () => {
    const { wrapper, sign } = mountController(makeTx('aaaa'));

    await wrapper.setProps({ activate: true });
    await sign('password');

    const signed = vi.mocked(collectRequiredKeys).mock.calls[0][0];
    expect(signed).toHaveLength(1);
    expect(signed[0].transactionBytes).toBe('aaaa');
    expect(signItems).toHaveBeenCalledWith([], 'password');
    expect(capture.toastSuccess).toHaveBeenCalledWith('Transaction signed successfully');
    expect(callback).toHaveBeenCalledWith(true);
  });

  test('signs the prop value even if it was replaced before activation', async () => {
    const { wrapper, sign } = mountController(makeTx('aaaa'));

    await wrapper.setProps({ transaction: makeTx('bbbb') });
    await wrapper.setProps({ activate: true });
    await sign('password');

    expect(vi.mocked(collectRequiredKeys).mock.calls[0][0][0].transactionBytes).toBe('bbbb');
  });

  test('returns a bug report and reports failure when there is no transaction', async () => {
    const { wrapper, sign } = mountController(null);

    await wrapper.setProps({ activate: true });
    const result = (await sign('password')) as any;

    expect(result?.status).toBe(ActionStatus.Error);
    expect(result?.title).toBe('Sign');
    expect(collectRequiredKeys).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });

  test.each([
    [1, 'Key is missing', 'Go to Settings and add the missing key'],
    [2, '2 keys are missing', 'Go to Settings and add the missing keys'],
  ])('reports %i missing key(s) without signing', async (count, what, next) => {
    vi.mocked(collectMissingKeys).mockReturnValueOnce(Array(count).fill({}) as any);
    const { wrapper, sign } = mountController(makeTx('aaaa'));

    await wrapper.setProps({ activate: true });
    const result = (await sign('password')) as any;

    expect(result).toMatchObject({ status: ActionStatus.Error, what, next });
    expect(signItems).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });

  test('reports an error when the signature was rejected', async () => {
    vi.mocked(signItems).mockResolvedValueOnce([{}] as any);
    const { wrapper, sign } = mountController(makeTx('aaaa'));

    await wrapper.setProps({ activate: true });
    const result = (await sign('password')) as any;

    expect(result).toMatchObject({
      status: ActionStatus.Error,
      what: 'Failed to sign transaction',
    });
    expect(capture.toastSuccess).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });

  test('forgets the signed transaction in the cache', async () => {
    const tx = makeTx('aaaa');
    const { wrapper, sign } = mountController(tx);

    await wrapper.setProps({ activate: true });
    await sign('password');

    expect(forgetTransaction).toHaveBeenCalledWith(tx, 'https://org.example.com');
  });

  test('forwards activate updates from the action controller', async () => {
    const { wrapper } = mountController(makeTx('aaaa'));

    capture.emit!('update:activate', true);

    expect(wrapper.emitted('update:activate')).toEqual([[true]]);
  });
});
