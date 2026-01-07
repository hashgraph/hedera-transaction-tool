/**
 * Performance Testing Utilities
 *
 * Helpers for measuring page load times and UI responsiveness.
 */

import { Page, Locator, expect } from '@playwright/test';
import { THRESHOLDS } from '../../k6/src/config/constants.js';
import { SELECTORS } from './selectors.js';

// Re-export k6 constants for UI perf tests (SSOT)
export { DATA_VOLUMES, THRESHOLDS } from '../../k6/src/config/constants.js';

// Debug mode - enable with DEBUG=true environment variable
export const DEBUG = process.env.DEBUG === 'true';

export const TARGET_LOAD_TIME_MS = THRESHOLDS.PAGE_LOAD_MS;
export const PAGE_SIZE = 50;
export const ROW_WAIT_TIMEOUT_MS = 5000;
export const TRANSACTION_ROW_SELECTOR = '.table-custom tbody tr';

export interface PerformanceSamples {
  avg: number;
  min: number;
  max: number;
  p95: number;
  values: number[];
}

/**
 * Collects multiple performance samples
 */
export async function collectPerformanceSamples(
  measureFn: () => Promise<number>,
  samples: number = 5,
): Promise<PerformanceSamples> {
  const values: number[] = [];

  for (let i = 0; i < samples; i++) {
    const time = await measureFn();
    values.push(time);
  }

  values.sort((a, b) => a - b);

  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: values[0],
    max: values.at(-1)!,
    p95: values[Math.floor(values.length * 0.95)],
    values,
  };
}

/**
 * Formats duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Wait for a minimum number of rows to appear in a list
 * Returns the actual count found
 */
export async function waitForRowCount(
  window: Page,
  rowSelector: string,
  minCount: number,
  timeout: number = ROW_WAIT_TIMEOUT_MS,
): Promise<number> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const rows = await window.$$(rowSelector);
    if (rows.length >= minCount) {
      return rows.length;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Return final count even if below threshold
  const finalRows = await window.$$(rowSelector);
  return finalRows.length;
}

/**
 * Set page size using the AppPager dropdown
 * @param window - Playwright page
 * @param size - Page size to select (5, 10, 20, or 50)
 * @returns true if page size was set, false if pager not found
 */
export async function setPageSize(window: Page, size: 5 | 10 | 20 | 50): Promise<boolean> {
  const dropdown = window.locator('.pager-per-page select');

  // Check if pager exists (some pages don't have it)
  const isVisible = await dropdown.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }

  await dropdown.selectOption(String(size));
  await window.waitForLoadState('networkidle');
  return true;
}

/**
 * Get total items from AppPager "X-Y of Z items" text
 * @param window - Playwright page
 * @returns Total item count, or null if pager not found
 */
export async function getPagerTotal(window: Page): Promise<number | null> {
  const pagerText = await window.locator('.pager-shown-items').textContent().catch(() => null);
  if (!pagerText) return null;
  // Parse "1-50 of 200 items" → 200
  const match = /of\s+(\d+)\s+items/.exec(pagerText);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Enforce volume requirement and verify data is visible
 * Sets page size, checks pager total, and waits for rows to render.
 *
 * @param window - Playwright page
 * @param requiredTotal - Minimum items expected in pager
 * @param tabName - Tab name for debug logging
 * @returns Initial row count found
 */
export async function enforceVolumeRequirement(
  window: Page,
  requiredTotal: number,
  tabName: string,
): Promise<number> {
  await setPageSize(window, PAGE_SIZE);

  const pagerTotal = await getPagerTotal(window);
  expect(pagerTotal, 'Pager not found - volume enforcement failed').not.toBeNull();
  expect(
    pagerTotal!,
    `Pager shows only ${pagerTotal} items, need >= ${requiredTotal}`,
  ).toBeGreaterThanOrEqual(requiredTotal);
  if (DEBUG) console.log(`Pager total: ${pagerTotal} items`);

  const initialRowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, 1, 5000);
  expect(initialRowCount, 'No transactions visible - check k6:seed:all and network').toBeGreaterThan(
    0,
  );
  if (DEBUG) console.log(`Found ${initialRowCount} transactions on ${tabName} tab`);

  return initialRowCount;
}

/**
 * Navigate to Ready to Sign tab and wait for data to load.
 *
 * @param window - Playwright page
 * @param refreshCache - Optional function to refresh the cached account RIGHT BEFORE the API call.
 *                       This is critical because the backend has a 10s TTL and the cache can be
 *                       overwritten by Mirror Node if we refresh too early.
 */
export async function navigateToReadyToSign(
  window: Page,
  refreshCache?: () => Promise<void>,
): Promise<void> {
  await window.click(SELECTORS.MENU_TRANSACTIONS);
  await window.waitForLoadState('networkidle');

  // Refresh cache RIGHT BEFORE clicking the tab (which triggers the API call)
  // This minimizes the window for Mirror Node to overwrite our test key
  if (refreshCache) {
    await refreshCache();
  }

  await window.click(SELECTORS.TAB_READY_TO_SIGN);

  await window.waitForResponse(
    (res) => res.url().includes('/transactions/sign') || res.url().includes('/transaction-nodes'),
    { timeout: 10000 },
  );
  await window.waitForLoadState('networkidle');
}

/**
 * Wait for transaction rows and find the first group row.
 * Used by Sign All tests that need to locate a transaction group.
 */
export async function waitForGroupRow(window: Page): Promise<Locator> {
  const rowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, 1, 5000);
  if (DEBUG) console.log(`Found ${rowCount} transaction rows`);

  const groupRow = window.locator('tr').filter({ has: window.locator(SELECTORS.GROUP_ROW_ICON) }).first();
  await expect(groupRow, 'No group row found - check seeding').toBeVisible({ timeout: 5000 });

  return groupRow;
}

/**
 * Execute Sign All button click with spinner visibility checks.
 * Handles the confirm dialog, verifies spinner appears during signing,
 * waits for success toast, and verifies spinner disappears.
 *
 * @param window - Playwright page
 * @param signAllButton - Locator for the Sign All button
 * @returns Sign time in milliseconds
 */
export async function executeSignAllWithSpinnerCheck(
  window: Page,
  signAllButton: Locator,
): Promise<number> {
  const startTime = Date.now();

  await signAllButton.click();

  const confirmButton = await window.waitForSelector(SELECTORS.BUTTON_CONFIRM, {
    timeout: 10000,
  });
  await confirmButton.click();

  const spinnerSelector = `${SELECTORS.BUTTON_SIGN_GROUP} ${SELECTORS.SPINNER_LOADING}`;
  const spinner = await window.waitForSelector(spinnerSelector, {
    state: 'visible',
    timeout: 2000,
  });
  expect(spinner, 'Loading spinner should appear during signing').not.toBeNull();
  if (DEBUG) console.log('Spinner visible during signing');

  await window.waitForSelector(SELECTORS.TOAST_SIGNED_SUCCESS, {
    timeout: 20000,
  });

  const signTime = Date.now() - startTime;

  // Wait for spinner to disappear (not just check immediately - avoids race condition)
  await window.waitForSelector(spinnerSelector, { state: 'hidden', timeout: 5000 });
  if (DEBUG) console.log('Spinner disappeared after signing');

  return signTime;
}
