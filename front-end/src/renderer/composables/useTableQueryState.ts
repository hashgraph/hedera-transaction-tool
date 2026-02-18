import { useRouter } from 'vue-router';

/**
 * Composable that reads `page`, `sort`, and `order` from the current URL query
 * parameters at setup time and provides a helper to write them back via
 * `router.replace()` (no new history entry).
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
  const query = router.currentRoute.value.query;

  // --- Read once at setup time ---

  const rawPage = typeof query.page === 'string' ? parseInt(query.page, 10) : NaN;
  const initialPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawPerPage = typeof query.perPage === 'string' ? parseInt(query.perPage, 10) : NaN;
  const initialPageSize = Number.isFinite(rawPerPage) && rawPerPage >= 1 ? rawPerPage : 10;

  const rawSort = typeof query.sort === 'string' ? query.sort : '';
  const initialSortField = validSortValues.includes(rawSort) ? rawSort : defaultSort;

  const rawOrder = typeof query.order === 'string' ? query.order : '';
  const initialSortDirection: 'asc' | 'desc' =
    rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaultOrder;

  // --- Write helper ---

  function syncToUrl(page: number, sortField: string, sortDirection: 'asc' | 'desc', pageSize?: number) {
    const existing = router.currentRoute.value.query;
    const newQuery: Record<string, string> = {};

    // Preserve the tab param
    if (typeof existing.tab === 'string') {
      newQuery.tab = existing.tab;
    }

    // Only include non-default values to keep URLs clean
    if (sortField !== defaultSort) {
      newQuery.sort = sortField;
    }
    if (sortDirection !== defaultOrder) {
      newQuery.order = sortDirection;
    }
    // Always include order when sort is present (and vice-versa) for clarity
    if (newQuery.sort && !newQuery.order) {
      newQuery.order = sortDirection;
    }
    if (newQuery.order && !newQuery.sort) {
      newQuery.sort = sortField;
    }
    if (page > 1) {
      newQuery.page = String(page);
    }
    if (pageSize != null && pageSize !== 10) {
      newQuery.perPage = String(pageSize);
    }

    router.replace({ query: newQuery });
  }

  return {
    initialPage,
    initialPageSize,
    initialSortField,
    initialSortDirection,
    syncToUrl,
  };
}
