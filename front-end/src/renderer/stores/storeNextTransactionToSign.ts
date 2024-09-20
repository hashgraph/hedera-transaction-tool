import type { ITransaction } from '@main/shared/interfaces';

import { ref } from 'vue';
import { defineStore } from 'pinia';

import useUserStore from './storeUser';
import useNetworkStore from './storeNetwork';

import { getTransactionsToSign } from '@renderer/services/organization';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

const useNextTransactionToSignStore = defineStore('nextTransactionToSign', () => {
  /* Stores */
  const user = useUserStore();
  const network = useNetworkStore();

  /* State */
  const transactionsIds = ref<number[]>([]);
  const sort = ref<{
    field: keyof ITransaction;
    direction: 'asc' | 'desc';
  }>({
    field: 'createdAt',
    direction: 'desc',
  });
  const page = ref<number | null>(null);
  const pageSize = ref<number | null>(null);

  /* Actions */
  const setTransactions = (
    _transactions: ITransaction[],
    _sort: typeof sort.value,
    _page: number,
    _pageSize: number,
  ) => {
    sort.value = _sort;
    page.value = _page;
    pageSize.value = _pageSize;
    transactionsIds.value = _transactions.map(t => t.id);
  };

  const getNext = async (currentId: number) => {
    if (!isLoggedInOrganization(user.selectedOrganization)) return null;

    const currentIndex = transactionsIds.value.findIndex(id => id === currentId);
    const lastSkippedId = transactionsIds.value[currentIndex - 1];

    if (currentIndex === -1) return null;
    if (typeof page.value !== 'number' || typeof pageSize.value !== 'number') return null;

    if (typeof transactionsIds.value[currentIndex + 1] !== 'number') {
      const { items } = await getTransactionsToSign(
        user.selectedOrganization.serverUrl,
        network.network,
        page.value,
        pageSize.value,
        [{ property: sort.value.field, direction: sort.value.direction }],
      );
      const newIds = items.map(t => t.transaction.id);
      setTransactions(
        items.map(t => t.transaction),
        sort.value,
        page.value,
        pageSize.value,
      );

      if (lastSkippedId === null) return newIds[0];
      if (typeof lastSkippedId === 'number')
        return transactionsIds.value[newIds.findIndex(id => id === lastSkippedId) + 1];
    }

    return transactionsIds.value[currentIndex + 1] || null;
  };

  return {
    setTransactions,
    getNext,
  };
});

export default useNextTransactionToSignStore;
