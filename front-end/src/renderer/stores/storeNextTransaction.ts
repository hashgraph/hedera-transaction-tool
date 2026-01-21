import { ref } from 'vue';
import { defineStore } from 'pinia';

const useNextTransactionStore = defineStore('nextTransaction', () => {
  /* Misc */
  const PAGE_SIZE = 100;

  /* State */
  const previousTransactionsIds = ref<(string | number)[] | null>(null);
  const getTransactions = ref<
    | ((
        page: number | null,
        pageSize: number | null,
      ) => Promise<{ items: (string | number)[]; totalItems: number }>)
    | null
  >(null);
  const getTransactionsHasPage = ref<boolean>(false);

  const cachedItems = ref<{ [page: string]: (string | number)[] } | null>(null);

  /* Actions */
  const setPreviousTransactionsIds = (ids: (string | number)[]) => {
    previousTransactionsIds.value = ids;
  };

  const setGetTransactionsFunction = (
    callback: (
      page: number | null,
      pageSize: number | null,
    ) => Promise<{ items: (string | number)[]; totalItems: number }>,
    hasPage: boolean,
  ) => {
    getTransactions.value = callback;
    getTransactionsHasPage.value = hasPage;
  };

  const findItem = async (
    currentId: string | number,
    findFunc: (id: string | number) => Promise<{
      currentFound: boolean;
      itemId: string | number | null;
    }>,
  ) => {
    if (!getTransactions.value) return null;
    if (!previousTransactionsIds.value) return null;

    const reversedPreviousIds = [...previousTransactionsIds.value, currentId].reverse();

    let id: string | number | null = null;

    cachedItems.value = null;

    for (let i = 0; i < reversedPreviousIds.length; i++) {
      const { currentFound, itemId } = await findFunc(reversedPreviousIds[i]);
      id = itemId;
      if (isId(id) || currentFound) break;
    }

    return id;
  };

  const getNext = async (currentId: string | number) => {
    return findItem(currentId, findNextTransactionId);
  };

  const getPrevious = async (currentId: string | number) => {
    return findItem(currentId, findPreviousTransactionId);
  };

  const findTransactionId = async (id: string | number, action: 'next' | 'prev') => {
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

      /* The current id is found, the items are paginated and the next is in the next page or prev is in prev page */
      if (foundGetFirst) {
        return {
          currentFound: true,
          itemId: action === 'next' ? items[0] : items[items.length - 1],
        };
      }

      /* The index of the current id */
      const idIndex = items.findIndex(item => item === id);

      /* The current id is found */
      const pageCondition = action === 'next' ? totalItems > page * PAGE_SIZE : page > 1;

      if (idIndex >= 0) {
        const item = action === 'next' ? items[idIndex + 1] : items[idIndex - 1];

        /* The next item is found in the same page */
        if (isId(item)) {
          return { currentFound: true, itemId: item };
        } else if (withPage && pageCondition) {
          /* The next item is not found in the same page but has more pages*/
          action === 'next' ? page++ : page--;
          foundGetFirst = true;
        } else {
          /* The next item is not found in the same page and there are no more pages */
          return { currentFound: true, itemId: null };
        }
      } else {
        if (withPage && pageCondition) {
          /* The current id is not found but has more pages */
          action === 'next' ? page++ : page--;
        } else {
          /* The current id is not found and there are no more pages */
          notExists = true;
        }
      }
    }

    return { currentFound: false, itemId: null };
  };

  const findNextTransactionId = async (
    id: string | number,
  ): Promise<{ currentFound: boolean; itemId: string | number | null }> => {
    return findTransactionId(id, 'next');
  };

  const findPreviousTransactionId = async (
    id: string | number,
  ): Promise<{ currentFound: boolean; itemId: string | number | null }> => {
    return findTransactionId(id, 'prev');
  };

  const reset = () => {
    previousTransactionsIds.value = null;
    getTransactions.value = null;
    getTransactionsHasPage.value = false;
    cachedItems.value = null;
  };

  const isId = (id: string | number | null) => typeof id === 'number' || typeof id === 'string';

  return {
    previousTransactionsIds,
    setPreviousTransactionsIds,
    setGetTransactionsFunction,
    getNext,
    getPrevious,
    reset,
  };
});

export default useNextTransactionStore;
