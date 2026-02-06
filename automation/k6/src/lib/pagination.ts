/**
 * Pagination Helper for k6 Tests
 *
 * Shared logic for fetching paginated API data with consistent error handling.
 */

import http from 'k6/http';
import { check } from 'k6';
import { HTTP_STATUS, PAGINATION } from '../config/constants';
import type { AuthHeaders, PaginatedResponse } from '../types';

export interface PageResult {
  page: number;
  duration: number;
  success: boolean;
  itemCount: number;
}

export interface PaginatedFetchResult<T> {
  items: T[];
  totalDuration: number;
  pageResults: PageResult[];
  totalItems: number;
}

export interface PaginatedFetchOptions {
  /** Full URL with page/size placeholders: e.g., '/transactions/sign?page=${page}&size=${size}' */
  buildUrl: (page: number, size: number) => string;
  /** Auth headers for the request */
  headers: AuthHeaders;
  /** Target item count to fetch */
  targetCount: number;
  /** Tag name for k6 metrics */
  tagName: string;
  /** Check name prefix for assertions */
  checkName: string;
}

/**
 * Fetch paginated data with consistent error handling
 *
 * Returns items and timing data - caller handles metrics recording.
 */
export function fetchPaginated<T>(options: PaginatedFetchOptions): PaginatedFetchResult<T> {
  const { buildUrl, headers, targetCount, tagName, checkName } = options;
  const startTime = Date.now();
  const items: T[] = [];
  const pageResults: PageResult[] = [];
  const pagesNeeded = Math.ceil(targetCount / PAGINATION.MAX_SIZE);

  for (let page = 1; page <= pagesNeeded; page++) {
    const url = buildUrl(page, PAGINATION.MAX_SIZE);
    const res = http.get(url, { ...headers, tags: { name: tagName } });

    const success = res.status === HTTP_STATUS.OK;
    const pageResult: PageResult = {
      page,
      duration: res.timings.duration,
      success,
      itemCount: 0,
    };

    check(res, {
      [`${checkName} page ${page} status 200`]: () => res.status === HTTP_STATUS.OK,
    });

    if (!success) {
      pageResults.push(pageResult);
      break;
    }

    try {
      const body = JSON.parse(res.body as string) as PaginatedResponse<T>;
      pageResult.itemCount = body.items.length;
      items.push(...body.items);
      pageResults.push(pageResult);

      // Stop if page is incomplete (no more data)
      if (body.items.length < PAGINATION.MAX_SIZE) break;
    } catch {
      pageResults.push(pageResult);
      break;
    }
  }

  return {
    items,
    totalDuration: Date.now() - startTime,
    pageResults,
    totalItems: items.length,
  };
}
