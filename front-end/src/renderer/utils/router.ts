import type { _RouterClassic, RouteLocationRaw } from 'vue-router';

export const redirectToPrevious = async (router: _RouterClassic, defaultRoute: RouteLocationRaw) => {
  await router.push(router.previousPath ?? defaultRoute);
};

export const redirectToPreviousTransactionsTab = async (router: _RouterClassic) => {
  await router.push({
    name: 'transactions',
    query: {
      tab: router.previousTab,
    },
  });
};
