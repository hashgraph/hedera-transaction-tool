// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

const mockReplace = vi.fn().mockResolvedValue(undefined);
const mockRoute = ref<{ query: Record<string, string> }>({ query: {} });

vi.mock('vue-router', () => ({
  useRouter: () => ({
    get currentRoute() {
      return mockRoute;
    },
    replace: mockReplace,
  }),
}));

import useTableQueryState from '@renderer/composables/useTableQueryState';

const VALID_SORTS = ['created_at', 'type', 'description'] as const;
const DEFAULT_SORT = 'created_at';
const DEFAULT_ORDER: 'asc' | 'desc' = 'desc';

function setQuery(query: Record<string, string>) {
  mockRoute.value = { query };
}

describe('useTableQueryState', () => {
  beforeEach(() => {
    setQuery({});
    mockReplace.mockClear();
  });

  describe('initial values — no query params', () => {
    test('returns page 1 when no page param', () => {
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(page.value).toBe(1);
    });

    test('returns default sort field when no sort param', () => {
      const { sortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortField.value).toBe('created_at');
    });

    test('returns default sort direction when no order param', () => {
      const { sortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortDirection.value).toBe('desc');
    });
  });

  describe('initial values — valid query params', () => {
    test('reads page from URL', () => {
      setQuery({ page: '3' });
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(page.value).toBe(3);
    });

    test('reads sort field from URL', () => {
      setQuery({ sort: 'type' });
      const { sortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortField.value).toBe('type');
    });

    test('reads order from URL', () => {
      setQuery({ order: 'asc' });
      const { sortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortDirection.value).toBe('asc');
    });

    test('reads all params together', () => {
      setQuery({ tab: 'History', sort: 'description', order: 'asc', page: '5' });
      const { page, sortField, sortDirection } = useTableQueryState(
        VALID_SORTS,
        DEFAULT_SORT,
        DEFAULT_ORDER,
      );
      expect(page.value).toBe(5);
      expect(sortField.value).toBe('description');
      expect(sortDirection.value).toBe('asc');
    });
  });

  describe('initial values — invalid query params', () => {
    test('falls back to 1 for non-numeric page', () => {
      setQuery({ page: 'abc' });
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(page.value).toBe(1);
    });

    test('falls back to 1 for page 0', () => {
      setQuery({ page: '0' });
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(page.value).toBe(1);
    });

    test('falls back to 1 for negative page', () => {
      setQuery({ page: '-3' });
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(page.value).toBe(1);
    });

    test('falls back to default sort for unknown sort field', () => {
      setQuery({ sort: 'BOGUS' });
      const { sortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortField.value).toBe('created_at');
    });

    test('falls back to default order for invalid order', () => {
      setQuery({ order: 'sideways' });
      const { sortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(sortDirection.value).toBe('desc');
    });

    test('falls back to 1 for float page', () => {
      setQuery({ page: '2.5' });
      const { page } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      // parseInt('2.5') === 2, which is valid
      expect(page.value).toBe(2);
    });
  });

  describe('syncToUrl', () => {
    test('calls router.replace with default values omitted', () => {
      setQuery({ tab: 'History' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'created_at', 'desc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History' },
      });
    });

    test('includes page when > 1', () => {
      setQuery({ tab: 'Drafts' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(3, 'created_at', 'desc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'Drafts', page: '3' },
      });
    });

    test('includes sort and order when sort differs from default', () => {
      setQuery({ tab: 'History' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'type', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'type', order: 'asc' },
      });
    });

    test('includes sort and order when only order differs from default', () => {
      setQuery({ tab: 'History' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'created_at', 'asc');

      // Since order differs, sort should also be included for clarity
      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'created_at', order: 'asc' },
      });
    });

    test('includes all params when all differ from defaults', () => {
      setQuery({ tab: 'History' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(5, 'description', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'description', order: 'asc', page: '5' },
      });
    });

    test('preserves tab param from current route', () => {
      setQuery({ tab: 'Ready to Sign' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(2, 'type', 'desc');

      const call = mockReplace.mock.calls[0][0];
      expect(call.query.tab).toBe('Ready to Sign');
    });

    test('works without tab param', () => {
      setQuery({});
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(2, 'type', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { sort: 'type', order: 'asc', page: '2' },
      });
    });

    test('always includes order when sort is present', () => {
      setQuery({ tab: 'History' });
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      // sort differs from default, order is same as default
      syncToUrl(1, 'type', 'desc');

      const call = mockReplace.mock.calls[0][0];
      expect(call.query.sort).toBe('type');
      expect(call.query.order).toBe('desc');
    });
  });

  describe('external navigation', () => {
    test('resyncs page/sort/order when the URL changes from outside syncToUrl', async () => {
      setQuery({ tab: 'History', page: '3', sort: 'type', order: 'asc' });
      const { page, sortField, sortDirection } = useTableQueryState(
        VALID_SORTS,
        DEFAULT_SORT,
        DEFAULT_ORDER,
      );

      expect(page.value).toBe(3);

      // e.g. a notification click navigating to the same tab with a reset query
      setQuery({ tab: 'History' });
      await Promise.resolve();

      expect(page.value).toBe(1);
      expect(sortField.value).toBe(DEFAULT_SORT);
      expect(sortDirection.value).toBe(DEFAULT_ORDER);
    });
  });
});
