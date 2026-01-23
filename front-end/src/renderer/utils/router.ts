import type { RouteLocationRaw, Router } from 'vue-router';

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
