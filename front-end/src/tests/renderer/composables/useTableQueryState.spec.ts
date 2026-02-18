// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockReplace = vi.fn();
let mockQuery: Record<string, string> = {};

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: {
      value: {
        query: mockQuery,
      },
    },
    replace: mockReplace,
  }),
}));

import useTableQueryState from '@renderer/composables/useTableQueryState';

const VALID_SORTS = ['created_at', 'type', 'description'] as const;
const DEFAULT_SORT = 'created_at';
const DEFAULT_ORDER: 'asc' | 'desc' = 'desc';

describe('useTableQueryState', () => {
  beforeEach(() => {
    mockQuery = {};
    mockReplace.mockClear();
  });

  describe('initial values — no query params', () => {
    test('returns page 1 when no page param', () => {
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialPage).toBe(1);
    });

    test('returns default sort field when no sort param', () => {
      const { initialSortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortField).toBe('created_at');
    });

    test('returns default sort direction when no order param', () => {
      const { initialSortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortDirection).toBe('desc');
    });
  });

  describe('initial values — valid query params', () => {
    test('reads page from URL', () => {
      mockQuery = { page: '3' };
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialPage).toBe(3);
    });

    test('reads sort field from URL', () => {
      mockQuery = { sort: 'type' };
      const { initialSortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortField).toBe('type');
    });

    test('reads order from URL', () => {
      mockQuery = { order: 'asc' };
      const { initialSortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortDirection).toBe('asc');
    });

    test('reads all params together', () => {
      mockQuery = { tab: 'History', sort: 'description', order: 'asc', page: '5' };
      const { initialPage, initialSortField, initialSortDirection } = useTableQueryState(
        VALID_SORTS,
        DEFAULT_SORT,
        DEFAULT_ORDER,
      );
      expect(initialPage).toBe(5);
      expect(initialSortField).toBe('description');
      expect(initialSortDirection).toBe('asc');
    });
  });

  describe('initial values — invalid query params', () => {
    test('falls back to 1 for non-numeric page', () => {
      mockQuery = { page: 'abc' };
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialPage).toBe(1);
    });

    test('falls back to 1 for page 0', () => {
      mockQuery = { page: '0' };
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialPage).toBe(1);
    });

    test('falls back to 1 for negative page', () => {
      mockQuery = { page: '-3' };
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialPage).toBe(1);
    });

    test('falls back to default sort for unknown sort field', () => {
      mockQuery = { sort: 'BOGUS' };
      const { initialSortField } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortField).toBe('created_at');
    });

    test('falls back to default order for invalid order', () => {
      mockQuery = { order: 'sideways' };
      const { initialSortDirection } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      expect(initialSortDirection).toBe('desc');
    });

    test('falls back to 1 for float page', () => {
      mockQuery = { page: '2.5' };
      const { initialPage } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);
      // parseInt('2.5') === 2, which is valid
      expect(initialPage).toBe(2);
    });
  });

  describe('syncToUrl', () => {
    test('calls router.replace with default values omitted', () => {
      mockQuery = { tab: 'History' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'created_at', 'desc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History' },
      });
    });

    test('includes page when > 1', () => {
      mockQuery = { tab: 'Drafts' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(3, 'created_at', 'desc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'Drafts', page: '3' },
      });
    });

    test('includes sort and order when sort differs from default', () => {
      mockQuery = { tab: 'History' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'type', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'type', order: 'asc' },
      });
    });

    test('includes sort and order when only order differs from default', () => {
      mockQuery = { tab: 'History' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(1, 'created_at', 'asc');

      // Since order differs, sort should also be included for clarity
      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'created_at', order: 'asc' },
      });
    });

    test('includes all params when all differ from defaults', () => {
      mockQuery = { tab: 'History' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(5, 'description', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { tab: 'History', sort: 'description', order: 'asc', page: '5' },
      });
    });

    test('preserves tab param from current route', () => {
      mockQuery = { tab: 'Ready to Sign' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(2, 'type', 'desc');

      const call = mockReplace.mock.calls[0][0];
      expect(call.query.tab).toBe('Ready to Sign');
    });

    test('works without tab param', () => {
      mockQuery = {};
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      syncToUrl(2, 'type', 'asc');

      expect(mockReplace).toHaveBeenCalledWith({
        query: { sort: 'type', order: 'asc', page: '2' },
      });
    });

    test('always includes order when sort is present', () => {
      mockQuery = { tab: 'History' };
      const { syncToUrl } = useTableQueryState(VALID_SORTS, DEFAULT_SORT, DEFAULT_ORDER);

      // sort differs from default, order is same as default
      syncToUrl(1, 'type', 'desc');

      const call = mockReplace.mock.calls[0][0];
      expect(call.query.sort).toBe('type');
      expect(call.query.order).toBe('desc');
    });
  });
});
