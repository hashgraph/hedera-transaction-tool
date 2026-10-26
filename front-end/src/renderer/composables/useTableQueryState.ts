import { ref, watch, type Ref } from 'vue';
import { useRouter, type LocationQuery } from 'vue-router';

interface TableQueryValues {
  page: number;
  pageSize: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

/**
 * Composable that reads `page`, `sort`, and `order` from the URL query parameters
 * and keeps them in sync in both directions:
 * - `syncToUrl()` writes table-driven changes (pager/sort clicks) out via `router.replace()`
 *   (no new history entry), so table state is bookmarkable/shareable.
 * - Navigations that change the query from outside the table (e.g. a notification routing
 *   to the same tab) are reflected back into the returned refs, so the table doesn't keep
 *   showing stale state once the URL no longer matches it.
 *
 * @param validSortValues - Allowed sort-field strings (used for validation).
 * @param defaultSort     - The default sort field string (omitted from URL).
 * @param defaultOrder    - The default sort direction (omitted from URL).
 */
export default function useTableQueryState(
  validSortValues: readonly string[],
  defaultSort: string,
  defaultOrder: 'asc' | 'desc',
) {
  const router = useRouter();

  function readFromQuery(query: LocationQuery): TableQueryValues {
    const rawPage = typeof query.page === 'string' ? parseInt(query.page, 10) : NaN;
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

    const rawPerPage = typeof query.perPage === 'string' ? parseInt(query.perPage, 10) : NaN;
    const pageSize = Number.isFinite(rawPerPage) && rawPerPage >= 1 ? rawPerPage : 10;

    const rawSort = typeof query.sort === 'string' ? query.sort : '';
    const sortField = validSortValues.includes(rawSort) ? rawSort : defaultSort;

    const rawOrder = typeof query.order === 'string' ? query.order : '';
    const sortDirection: 'asc' | 'desc' =
      rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaultOrder;

    return { page, pageSize, sortField, sortDirection };
  }

  const initial = readFromQuery(router.currentRoute.value.query);

  const page: Ref<number> = ref(initial.page);
  const pageSize: Ref<number> = ref(initial.pageSize);
  const sortField: Ref<string> = ref(initial.sortField);
  const sortDirection: Ref<'asc' | 'desc'> = ref(initial.sortDirection);

  // --- Write helper ---

  let syncingSelf = false;

  function syncToUrl(newPage: number, newSortField: string, newSortDirection: 'asc' | 'desc', newPageSize?: number) {
    const existing = router.currentRoute.value.query;
    const newQuery: Record<string, string> = {};

    // Preserve the tab param
    if (typeof existing.tab === 'string') {
      newQuery.tab = existing.tab;
    }

    // Only include non-default values to keep URLs clean
    if (newSortField !== defaultSort) {
      newQuery.sort = newSortField;
    }
    if (newSortDirection !== defaultOrder) {
      newQuery.order = newSortDirection;
    }
    // Always include order when sort is present (and vice-versa) for clarity
    if (newQuery.sort && !newQuery.order) {
      newQuery.order = newSortDirection;
    }
    if (newQuery.order && !newQuery.sort) {
      newQuery.sort = newSortField;
    }
    if (newPage > 1) {
      newQuery.page = String(newPage);
    }
    if (newPageSize != null && newPageSize !== 10) {
      newQuery.perPage = String(newPageSize);
    }

    syncingSelf = true;
    Promise.resolve(router.replace({ query: newQuery })).finally(() => {
      syncingSelf = false;
    });
  }

  // --- React to query changes that didn't come from syncToUrl above ---

  watch(
    () => router.currentRoute.value.query,
    newQuery => {
      if (syncingSelf) return;
      const next = readFromQuery(newQuery);
      page.value = next.page;
      pageSize.value = next.pageSize;
      sortField.value = next.sortField;
      sortDirection.value = next.sortDirection;
    },
  );

  return {
    page,
    pageSize,
    sortField,
    sortDirection,
    syncToUrl,
  };
}
