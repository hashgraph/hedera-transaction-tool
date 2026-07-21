import type { _RouterClassic, RouteLocationRaw } from 'vue-router';

export const redirectToPrevious = async (router: _RouterClassic, defaultRoute: RouteLocationRaw) => {
  const xRouter = router as _RouterClassic & Record<string, string>;
  await router.push(xRouter.previousPath ?? defaultRoute);
};

export const redirectToPreviousTransactionsTab = async (router: _RouterClassic) => {
  const xRouter = router as _RouterClassic &  Record<string, string>;
  await router.push({
    name: 'transactions',
    query: {
      tab: xRouter.previousTab,
    },
  });
};
