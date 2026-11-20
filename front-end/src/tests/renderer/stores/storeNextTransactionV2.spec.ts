import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { _RouterClassic } from 'vue-router';

import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({}) },
}));
vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({ selectedOrganization: null }),
}));
vi.mock('@renderer/stores/storeNetwork.ts', () => ({
  default: () => ({}),
}));

const fakeRouter = () => ({ push: vi.fn() }) as unknown as _RouterClassic;

describe('storeNextTransactionV2 — carrying the real transaction id on the route', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('attaches a txId query param when the node carries a known sdkTransactionId', async () => {
    const store = useNextTransactionV2();
    const router = fakeRouter();
    const target = { transactionId: 42, sdkTransactionId: '0.0.1@1700000000.000000001' };

    await store.routeDown(target, [target], router, null, true, false);

    expect(router.push).toHaveBeenCalledWith({
      name: 'transactionDetails',
      params: { id: 42 },
      query: { txId: '0.0.1@1700000000.000000001' },
      replace: false,
    });
  });

  test('omits the query param when no sdkTransactionId is known', async () => {
    const store = useNextTransactionV2();
    const router = fakeRouter();
    const target = { transactionId: 42 };

    await store.routeDown(target, [target], router, null, true, true);

    expect(router.push).toHaveBeenCalledWith({
      name: 'transactionDetails',
      params: { id: 42 },
      query: undefined,
      replace: true,
    });
  });

  test('routing to a group never attaches a query param', async () => {
    const store = useNextTransactionV2();
    const router = fakeRouter();
    const target = { groupId: 9 };

    await store.routeDown(target, [target], router, null, true, false);

    expect(router.push).toHaveBeenCalledWith({
      name: 'transactionGroupDetails',
      params: { id: 9 },
      replace: false,
    });
  });

  test('routeToNext replays the carried sdkTransactionId for the next node', async () => {
    const store = useNextTransactionV2();
    const router = fakeRouter();
    const collection = [
      { transactionId: 1, sdkTransactionId: '0.0.1@1.1' },
      { transactionId: 2, sdkTransactionId: '0.0.1@2.2' },
    ];

    await store.routeDown(collection[0], collection, router, null, true, false);
    await store.routeToNext(router);

    expect(router.push).toHaveBeenLastCalledWith({
      name: 'transactionDetails',
      params: { id: 2 },
      query: { txId: '0.0.1@2.2' },
      replace: true,
    });
  });
});
