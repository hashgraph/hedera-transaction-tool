// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

import useAccountId from '@renderer/composables/useAccountId';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  getAccountAllowances: vi.fn(),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ mirrorNodeBaseURL: 'http://mirror', client: {} })),
}));

vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: { inject: () => ({ mirrorAccountById: { lookup: mocks.lookup } }) },
}));

vi.mock('@renderer/services/mirrorNodeDataService', () => ({
  getAccountAllowances: mocks.getAccountAllowances,
}));

vi.mock('@renderer/services/electronUtilsService', () => ({ openExternal: vi.fn() }));
vi.mock('@renderer/services/keyPairService', () => ({ flattenKeyList: vi.fn(() => []) }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAccountId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAccountAllowances.mockResolvedValue([]);
  });

  test('ignores a late response for an outdated account id', async () => {
    const stale = deferred<unknown>();
    const current = deferred<unknown>();
    mocks.lookup.mockImplementation((id: string) =>
      id === '0.0.118' ? stale.promise : current.promise,
    );

    const store = useAccountId();
    store.accountId.value = '0.0.118';
    await flushPromises();
    store.accountId.value = '0.0.1180';
    await flushPromises();

    const info = { accountId: { toString: () => '0.0.1180' } };
    current.resolve(info);
    await flushPromises();
    expect(store.isValid.value).toBe(true);

    // The outdated lookup resolves to "not found" after the current one
    stale.resolve(null);
    await flushPromises();

    expect(store.isValid.value).toBe(true);
    expect(store.accountInfo.value).toStrictEqual(info);
    expect(store.isLoading.value).toBe(false);
  });

  test('a failed outdated lookup does not reset the current account', async () => {
    const stale = deferred<unknown>();
    const current = deferred<unknown>();
    mocks.lookup.mockImplementation((id: string) =>
      id === '0.0.118' ? stale.promise : current.promise,
    );

    const store = useAccountId();
    store.accountId.value = '0.0.118';
    await flushPromises();
    store.accountId.value = '0.0.1180';
    await flushPromises();

    const info = { accountId: { toString: () => '0.0.1180' } };
    current.resolve(info);
    await flushPromises();
    stale.reject(new Error('boom'));
    await flushPromises();

    expect(store.accountInfo.value).toStrictEqual(info);
  });

  test('keeps account info when loading allowances fails', async () => {
    const info = { accountId: { toString: () => '0.0.1001' } };
    mocks.lookup.mockResolvedValue(info);
    mocks.getAccountAllowances.mockRejectedValue(new Error('429'));

    const store = useAccountId();
    store.accountId.value = '0.0.1001';
    await flushPromises();

    expect(store.isValid.value).toBe(true);
    expect(store.allowances.value).toEqual([]);
  });

  test('clearing the id resets state', async () => {
    mocks.lookup.mockResolvedValue({ accountId: { toString: () => '0.0.1001' } });

    const store = useAccountId();
    store.accountId.value = '0.0.1001';
    await flushPromises();
    expect(store.isValid.value).toBe(true);

    store.accountId.value = '';
    await flushPromises();
    expect(store.isValid.value).toBe(false);
    expect(store.isLoading.value).toBe(false);
  });
});
