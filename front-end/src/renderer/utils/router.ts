import type { Router } from 'vue-router';

export const KEEP_NEXT_QUERY_KEY = 'keepNextTransaction';

export const redirectToDetails = (
  router: Router,
  id: string | number,
  keepNextQueryKey = false,
  replace = false,
) => {
  const query: any = {};

  if (keepNextQueryKey) {
    query[KEEP_NEXT_QUERY_KEY] = 'true';
  }

  router.push({
    name: 'transactionDetails',
    params: { id },
    query,
    replace,
  });
};
