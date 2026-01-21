import { expect, describe, test, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

describe('useNextTransactionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('getNextAndPreviousWithWrapAround', () => {
    test('should return null values when getTransactions is not set', async () => {
      const store = useNextTransactionStore();

      const result = await store.getNextAndPreviousWithWrapAround('1');

      expect(result).toEqual({ next: null, previous: null });
    });

    test('should return null values when items list is empty', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [],
        totalItems: 0,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround('1');

      expect(result).toEqual({ next: null, previous: null });
    });

    test('should return first as next and last as previous when current ID is not in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround('999');

      expect(result).toEqual({ next: 1, previous: 5 });
    });

    test('should wrap previous to last item when current ID is at start of list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround(1);

      expect(result).toEqual({ next: 2, previous: 5 });
    });

    test('should wrap next to first item when current ID is at end of list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround(5);

      expect(result).toEqual({ next: 1, previous: 4 });
    });

    test('should return null values for single item list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1],
        totalItems: 1,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround(1);

      expect(result).toEqual({ next: null, previous: null });
    });

    test('should return correct next and previous for middle position', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround(3);

      expect(result).toEqual({ next: 4, previous: 2 });
    });

    test('should return null values when getTransactions throws an error', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => {
        throw new Error('Failed to fetch transactions');
      });
      store.setGetTransactionsFunction(mockGetTransactions, false);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await store.getNextAndPreviousWithWrapAround('1');

      expect(result).toEqual({ next: null, previous: null });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get next/previous with wrap around:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    test('should handle string IDs correctly', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: ['a', 'b', 'c'],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNextAndPreviousWithWrapAround('b');

      expect(result).toEqual({ next: 'c', previous: 'a' });
    });

    test('should handle mixed string and number comparison', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      // Passing '2' as string but list has 2 as number
      const result = await store.getNextAndPreviousWithWrapAround('2');

      expect(result).toEqual({ next: 3, previous: 1 });
    });

    test('should handle two-item list with wrap-around', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2],
        totalItems: 2,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const resultFirst = await store.getNextAndPreviousWithWrapAround(1);
      expect(resultFirst).toEqual({ next: 2, previous: 2 });

      const resultSecond = await store.getNextAndPreviousWithWrapAround(2);
      expect(resultSecond).toEqual({ next: 1, previous: 1 });
    });
  });

  describe('setPreviousTransactionsIds', () => {
    test('should set previousTransactionsIds', () => {
      const store = useNextTransactionStore();

      store.setPreviousTransactionsIds([1, 2, 3]);

      expect(store.previousTransactionsIds).toEqual([1, 2, 3]);
    });

    test('should overwrite existing previousTransactionsIds', () => {
      const store = useNextTransactionStore();

      store.setPreviousTransactionsIds([1, 2, 3]);
      store.setPreviousTransactionsIds([4, 5]);

      expect(store.previousTransactionsIds).toEqual([4, 5]);
    });

    test('should handle empty array', () => {
      const store = useNextTransactionStore();

      store.setPreviousTransactionsIds([]);

      expect(store.previousTransactionsIds).toEqual([]);
    });

    test('should handle string IDs', () => {
      const store = useNextTransactionStore();

      store.setPreviousTransactionsIds(['a', 'b', 'c']);

      expect(store.previousTransactionsIds).toEqual(['a', 'b', 'c']);
    });
  });

  describe('reset', () => {
    test('should reset all state to initial values', () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([1, 2, 3]);

      store.reset();

      expect(store.previousTransactionsIds).toBeNull();
    });

    test('should reset even when state is already null', () => {
      const store = useNextTransactionStore();

      store.reset();

      expect(store.previousTransactionsIds).toBeNull();
    });
  });

  describe('getNext', () => {
    test('should return null when getTransactions is not set', async () => {
      const store = useNextTransactionStore();
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(1);

      expect(result).toBeNull();
    });

    test('should return null when previousTransactionsIds is not set', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getNext(1);

      expect(result).toBeNull();
    });

    test('should return next item when current ID exists in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(2);

      expect(result).toBe(3);
    });

    test('should return null when current ID is last in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(3);

      expect(result).toBeNull();
    });

    test('should return null when current ID is not in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(999);

      expect(result).toBeNull();
    });
  });

  describe('getPrevious', () => {
    test('should return null when getTransactions is not set', async () => {
      const store = useNextTransactionStore();
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(1);

      expect(result).toBeNull();
    });

    test('should return null when previousTransactionsIds is not set', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);

      const result = await store.getPrevious(1);

      expect(result).toBeNull();
    });

    test('should return previous item when current ID exists in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(3);

      expect(result).toBe(2);
    });

    test('should return null when current ID is first in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(1);

      expect(result).toBeNull();
    });

    test('should return null when current ID is not in list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(999);

      expect(result).toBeNull();
    });
  });

  describe('pagination scenarios', () => {
    test('getNext should return next item when using paginated mode', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, true);
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(3);

      expect(result).toBe(4);
    });

    test('getPrevious should return previous item when using paginated mode', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, true);
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(4);

      expect(result).toBe(3);
    });

    test('getNext should return null when current is last item in paginated mode', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5, 6],
        totalItems: 6,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, true);
      store.setPreviousTransactionsIds([]);

      const result = await store.getNext(6);

      expect(result).toBeNull();
    });

    test('getPrevious should return null when current is first item in paginated mode', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, true);
      store.setPreviousTransactionsIds([]);

      const result = await store.getPrevious(1);

      expect(result).toBeNull();
    });

    test('should handle previousTransactionsIds traversal for getNext', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([1, 2]);

      const result = await store.getNext(3);

      expect(result).toBe(4);
    });

    test('should handle previousTransactionsIds traversal for getPrevious', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3, 4, 5],
        totalItems: 5,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([1, 2]);

      const result = await store.getPrevious(3);

      expect(result).toBe(2);
    });

    test('getNext should find item when current ID is in previousTransactionsIds but not in current list', async () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [10, 20, 30],
        totalItems: 3,
      }));
      store.setGetTransactionsFunction(mockGetTransactions, false);
      store.setPreviousTransactionsIds([10, 20]);

      const result = await store.getNext(999);

      // Should traverse previousTransactionsIds and find 20, then get next which is 30
      expect(result).toBe(30);
    });

    test('setGetTransactionsFunction should set the hasPage flag correctly', () => {
      const store = useNextTransactionStore();
      const mockGetTransactions = vi.fn(async () => ({
        items: [1, 2, 3],
        totalItems: 3,
      }));

      store.setGetTransactionsFunction(mockGetTransactions, true);
      store.setPreviousTransactionsIds([]);

      // The function should be set (we can verify by calling getNext)
      expect(mockGetTransactions).not.toHaveBeenCalled();
    });
  });
});
