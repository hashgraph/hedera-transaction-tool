import type { ITransaction } from '@main/shared/interfaces';

import { ref } from 'vue';
import { defineStore } from 'pinia';

export const KEEP_NEXT_QUERY_KEY = 'keepNextTransaction';

const useNextTransactionStore = defineStore('nextTransaction', () => {
  /* Misc */
  const PAGE_SIZE = 100;

  /* State */
  const previousTransactionsIds = ref<number[] | null>(null);
  const getTransactions = ref<
    | ((
        page: number | null,
        pageSize: number | null,
      ) => Promise<{ items: ITransaction[]; totalItems: number }>)
    | null
  >(null);
  const getTransactionsHasPage = ref<boolean>(false);

  const cachedItems = ref<{ [page: string]: ITransaction[] } | null>(null);

  /* Actions */
  const setPreviousTransactionsIds = (ids: number[]) => {
    previousTransactionsIds.value = ids;
  };

  const setGetTransactionsFunction = (
    callback: (
      page: number | null,
      pageSize: number | null,
    ) => Promise<{ items: ITransaction[]; totalItems: number }>,
    hasPage: boolean,
  ) => {
    getTransactions.value = callback;
    getTransactionsHasPage.value = hasPage;
  };

  const getNext = async (currentId: number) => {
    if (!getTransactions.value) return null;
    if (!previousTransactionsIds.value) return null;

    const reversedPreviousIds = [...previousTransactionsIds.value, currentId].reverse();

    let id: number | null = null;

    cachedItems.value = null;

    for (let i = 0; i < reversedPreviousIds.length; i++) {
      const { currentFound, nextId } = await findNextTransactionId(reversedPreviousIds[i]);
      id = nextId;
      if (typeof id === 'number' || currentFound) break;
    }

    if (typeof id !== 'number') {
      const items = Object.values<ITransaction[]>(cachedItems.value || {})
        .flat()
        .filter(i => !reversedPreviousIds.includes(i.id));
      cachedItems.value = null;

      return items[0]?.id || null;
    }

    return id;
  };

  const findNextTransactionId = async (
    id: number,
  ): Promise<{ currentFound: boolean; nextId: number | null }> => {
    if (!getTransactions.value) throw new Error('No transaction fetching function set');

    const withPage = getTransactionsHasPage.value;

    let notExists = false;
    let foundGetFirst = false;
    let page = 1;

    while (!notExists) {
      let totalItems = 0;

      /* Cache the items FOR THE CURRENT SEARCH */
      if (!cachedItems.value || cachedItems.value[page] === undefined) {
        const { items, totalItems: total } = await getTransactions.value(
          withPage ? page : null,
          withPage ? PAGE_SIZE : null,
        );

        if (!cachedItems.value) cachedItems.value = {};
        cachedItems.value[withPage ? page : -1] = items;
        totalItems = total;
      }

      /* Get the items from the cache */
      const items = cachedItems.value[withPage ? page : -1];

      /* The current id is found, the items are paginated and the next is in the next page */
      if (foundGetFirst) return { currentFound: true, nextId: items[0].id };

      /* The index of the current id */
      const idIndex = items.findIndex(item => item.id === id);

      /* The current id is found */
      if (idIndex >= 0) {
        const nextItem = items[idIndex + 1];

        /* The next item is found in the same page */
        if (nextItem) {
          return { currentFound: true, nextId: nextItem.id };
        } else if (withPage && totalItems > page * PAGE_SIZE) {
          /* The next item is not found in the same page but has more pages*/
          page++;
          foundGetFirst = true;
        } else {
          /* The next item is not found in the same page and there are no more pages */
          return { currentFound: true, nextId: null };
        }
      } else {
        if (withPage && totalItems > page * PAGE_SIZE) {
          /* The current id is not found but has more pages */
          page++;
        } else {
          /* The current id is not found and there are no more pages */
          notExists = true;
        }
      }
    }

    return { currentFound: false, nextId: null };
  };

  const reset = () => {
    previousTransactionsIds.value = null;
    getTransactions.value = null;
    getTransactionsHasPage.value = false;
    cachedItems.value = null;
  };

  return {
    previousTransactionsIds,
    setPreviousTransactionsIds,
    setGetTransactionsFunction,
    getNext,
    reset,
  };
});

export default useNextTransactionStore;
