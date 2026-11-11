// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

import { Hbar } from '@hiero-ledger/sdk';

import useAccountId from '@renderer/composables/useAccountId';
import { openExternal } from '@renderer/services/electronUtilsService';
import { flattenKeyList } from '@renderer/services/keyPairService';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  getAccountAllowances: vi.fn(),
  networkStore: { mirrorNodeBaseURL: 'http://mirror', client: {}, network: 'testnet' },
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => mocks.networkStore),
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
    mocks.networkStore.network = 'testnet';
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

  test('resets state and stops loading when the id is not a valid account id', async () => {
    const store = useAccountId();
    store.accountId.value = 'not-an-id';
    await flushPromises();

    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(store.isValid.value).toBe(false);
    expect(store.allowances.value).toEqual([]);
    expect(store.isLoading.value).toBe(false);
  });

  test('fetchAccountInfo returns null when the lookup fails', async () => {
    mocks.lookup.mockRejectedValue(new Error('404'));

    const store = useAccountId();
    await expect(store.fetchAccountInfo('0.0.1001')).resolves.toBeNull();

    store.accountId.value = '0.0.1001';
    await flushPromises();
    expect(store.isValid.value).toBe(false);
    expect(store.isLoading.value).toBe(false);
  });

  test('strips the checksum before looking the account up', async () => {
    mocks.lookup.mockResolvedValue({ accountId: { toString: () => '0.0.1001' } });

    const store = useAccountId();
    store.accountId.value = '0.0.1001-abcde';
    await flushPromises();

    expect(mocks.lookup).toHaveBeenCalledWith('0.0.1001', 'http://mirror', true);
    expect(mocks.getAccountAllowances).toHaveBeenCalledWith(
      '0.0.1001',
      'http://mirror',
      expect.any(AbortController),
    );
  });

  describe('derived values', () => {
    async function loaded(info: Record<string, unknown> = {}, id = '0.0.1001') {
      mocks.lookup.mockResolvedValue({ accountId: { toString: () => id }, ...info });
      const store = useAccountId();
      store.accountId.value = id;
      await flushPromises();
      return store;
    }

    test('accountIdFormatted and accountIdWithChecksum before the account is loaded', () => {
      const store = useAccountId();
      store.accountId.value = '0.0.5';
      expect(store.accountIdFormatted.value).toBe('0.0.5');
      expect(store.accountIdWithChecksum.value).toBe('0.0.5');
    });

    test('accountIdFormatted keeps a checksum suffix and normalizes otherwise', async () => {
      const store = await loaded();
      expect(store.accountIdFormatted.value).toBe('0.0.1001');

      store.accountId.value = '0.0.1001-abcde';
      expect(store.accountIdFormatted.value).toBe('0.0.1001-abcde');
    });

    test('accountIdFormatted falls back to the raw id when it cannot be parsed', async () => {
      const store = await loaded();
      store.accountId.value = 'garbage';
      expect(store.accountIdFormatted.value).toBe('garbage');
    });

    test('accountIdWithChecksum splits the checksum from the id', async () => {
      const store = await loaded({
        accountId: { toStringWithChecksum: () => '0.0.1001-abcde' },
      });
      expect(store.accountIdWithChecksum.value).toEqual(['0.0.1001', 'abcde']);
    });

    test('accountIdWithChecksum falls back to the formatted id when it throws', async () => {
      const store = await loaded({
        accountId: {
          toStringWithChecksum: () => {
            throw new Error('no client');
          },
        },
      });
      expect(store.accountIdWithChecksum.value).toBe(store.accountIdFormatted.value);
    });

    test('autoRenewPeriodInDays converts seconds to days', async () => {
      expect((await loaded({ autoRenewPeriod: 86400 * 90 })).autoRenewPeriodInDays.value).toBe(
        '90',
      );
      expect(useAccountId().autoRenewPeriodInDays.value).toBe('0');
    });

    test('key and keysFlattened', async () => {
      const key = { id: 'key' };
      vi.mocked(flattenKeyList).mockReturnValue([{ toStringRaw: () => 'raw-1' }] as never);

      const store = await loaded({ key });
      expect(store.key.value).toStrictEqual(key);
      expect(store.keysFlattened.value).toEqual(['raw-1']);

      const empty = useAccountId();
      expect(empty.key.value).toBeNull();
      expect(empty.keysFlattened.value).toEqual([]);
    });

    test('getSpenderAllowance returns the allowed amount, or zero when there is none', async () => {
      mocks.getAccountAllowances.mockResolvedValue([{ spender: '0.0.7', amount: 42 }]);
      const store = await loaded();

      expect(store.getSpenderAllowance('0.0.7').toTinybars().toNumber()).toBe(42);
      expect(store.getSpenderAllowance('0.0.8').toTinybars().toNumber()).toBe(0);
    });

    test('getStakedToString', async () => {
      expect((await loaded({ stakedNodeId: 3 })).getStakedToString()).toBe('Node 3');
      expect((await loaded({ stakedAccountId: '0.0.9' })).getStakedToString()).toBe(
        'Account 0.0.9',
      );
      expect((await loaded()).getStakedToString()).toBe('None');
    });

    test('getFormattedPendingRewards', async () => {
      expect(
        (
          await loaded({ pendingRewards: Hbar.fromTinybars(100_000_000) })
        ).getFormattedPendingRewards(),
      ).toContain('1');
      expect(useAccountId().getFormattedPendingRewards()).toBe(Hbar.fromString('0').toString());
    });

    test('openAccountInHashscan opens hashscan except on custom networks', async () => {
      const store = await loaded();
      store.openAccountInHashscan();
      expect(openExternal).toHaveBeenCalledWith(
        expect.stringContaining('hashscan.io/testnet/account/0.0.1001'),
      );

      vi.mocked(openExternal).mockClear();
      mocks.networkStore.network = 'custom';
      store.openAccountInHashscan();
      expect(openExternal).not.toHaveBeenCalled();
    });
  });
});
