import type { RouteLocationRaw, Router } from 'vue-router';

export const KEEP_NEXT_QUERY_KEY = 'keepNextTransaction';

export const redirectToDetails = (
  router: Router,
  id: string | number,
  keepNextQueryKey = false,
  replace = false,
  fromInProgressTab?: boolean,
) => {
  const query: any = {};

  if (keepNextQueryKey) {
    query[KEEP_NEXT_QUERY_KEY] = 'true';
  }

  if (fromInProgressTab) {
    query['fromInProgress'] = 'true';
  }

  router.push({
    name: 'transactionDetails',
    params: { id },
    query,
    replace,
  });
};

export const redirectToGroupDetails = async (
  router: Router,
  id: string | number,
  previousTab?: string,
) => {
  await router.push({
    name: 'transactionGroupDetails',
    params: { id },
    query: previousTab ? { previousTab } : {},
  });
};

export const redirectToPrevious = async (router: Router, defaultRoute: RouteLocationRaw) => {
  await router.push(router.previousPath ?? defaultRoute);
};

export const redirectToPreviousTransactionsTab = async (router: Router) => {
  await router.push({
    name: 'transactions',
    query: {
      tab: router.previousTab,
    },
  });
};
