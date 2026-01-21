import { expect, describe, test, vi, beforeEach } from 'vitest';
import {
  redirectToDetails,
  redirectToGroupDetails,
  redirectToPrevious,
  redirectToPreviousTransactionsTab,
  KEEP_NEXT_QUERY_KEY,
} from '@renderer/utils/router';
import type { Router, RouteLocationRaw } from 'vue-router';

describe('router utilities', () => {
  let mockRouter: Router;

  beforeEach(() => {
    mockRouter = {
      push: vi.fn(),
      previousPath: null,
      previousTab: null,
    } as unknown as Router;
  });

  describe('redirectToDetails', () => {
    test('should redirect to transaction details with id', () => {
      redirectToDetails(mockRouter, '123');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: {},
        replace: false,
      });
    });

    test('should include keepNextTransaction query param when keepNextQueryKey is true', () => {
      redirectToDetails(mockRouter, '123', true);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: { [KEEP_NEXT_QUERY_KEY]: 'true' },
        replace: false,
      });
    });

    test('should use replace navigation when replace is true', () => {
      redirectToDetails(mockRouter, '123', false, true);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: {},
        replace: true,
      });
    });

    test('should include fromInProgress query param when fromInProgressTab is true', () => {
      redirectToDetails(mockRouter, '123', false, false, true);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: { fromInProgress: 'true' },
        replace: false,
      });
    });

    test('should include fromCollection query param when provided', () => {
      redirectToDetails(mockRouter, '123', false, false, false, 'READY_TO_SIGN');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: { fromCollection: 'READY_TO_SIGN' },
        replace: false,
      });
    });

    test('should include all query params when all options are set', () => {
      redirectToDetails(mockRouter, '123', true, true, true, 'READY_TO_SIGN');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: '123' },
        query: {
          [KEEP_NEXT_QUERY_KEY]: 'true',
          fromInProgress: 'true',
          fromCollection: 'READY_TO_SIGN',
        },
        replace: true,
      });
    });

    test('should handle numeric id', () => {
      redirectToDetails(mockRouter, 456);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionDetails',
        params: { id: 456 },
        query: {},
        replace: false,
      });
    });
  });

  describe('redirectToGroupDetails', () => {
    test('should redirect to transaction group details with id', async () => {
      await redirectToGroupDetails(mockRouter, '123');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionGroupDetails',
        params: { id: '123' },
        query: {},
      });
    });

    test('should include previousTab query param when provided', async () => {
      await redirectToGroupDetails(mockRouter, '123', 'pending');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionGroupDetails',
        params: { id: '123' },
        query: { previousTab: 'pending' },
      });
    });

    test('should include fromCollection query param when provided', async () => {
      await redirectToGroupDetails(mockRouter, '123', undefined, 'READY_TO_SIGN');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionGroupDetails',
        params: { id: '123' },
        query: { fromCollection: 'READY_TO_SIGN' },
      });
    });

    test('should include both previousTab and fromCollection when both provided', async () => {
      await redirectToGroupDetails(mockRouter, '123', 'pending', 'READY_TO_SIGN');

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionGroupDetails',
        params: { id: '123' },
        query: { previousTab: 'pending', fromCollection: 'READY_TO_SIGN' },
      });
    });

    test('should handle numeric id', async () => {
      await redirectToGroupDetails(mockRouter, 456);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactionGroupDetails',
        params: { id: 456 },
        query: {},
      });
    });
  });

  describe('redirectToPrevious', () => {
    test('should redirect to previousPath when available', async () => {
      const routerWithPreviousPath = {
        ...mockRouter,
        previousPath: '/previous-route',
      } as unknown as Router;

      await redirectToPrevious(routerWithPreviousPath, { name: 'home' });

      expect(routerWithPreviousPath.push).toHaveBeenCalledWith('/previous-route');
    });

    test('should redirect to default route when previousPath is null', async () => {
      const defaultRoute: RouteLocationRaw = { name: 'home' };

      await redirectToPrevious(mockRouter, defaultRoute);

      expect(mockRouter.push).toHaveBeenCalledWith(defaultRoute);
    });
  });

  describe('redirectToPreviousTransactionsTab', () => {
    test('should redirect to transactions with previousTab query param', async () => {
      const routerWithPreviousTab = {
        ...mockRouter,
        previousTab: 'pending',
      } as unknown as Router;

      await redirectToPreviousTransactionsTab(routerWithPreviousTab);

      expect(routerWithPreviousTab.push).toHaveBeenCalledWith({
        name: 'transactions',
        query: { tab: 'pending' },
      });
    });

    test('should redirect to transactions with null tab when previousTab is not set', async () => {
      await redirectToPreviousTransactionsTab(mockRouter);

      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'transactions',
        query: { tab: null },
      });
    });
  });

  describe('KEEP_NEXT_QUERY_KEY', () => {
    test('should have correct value', () => {
      expect(KEEP_NEXT_QUERY_KEY).toBe('keepNextTransaction');
    });
  });
});
