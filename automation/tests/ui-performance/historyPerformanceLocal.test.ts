/**
 * Performance Test: History Tab (Local Mode)
 *
 * Requirement: 500 transactions in DB, page load in <= 1s
 * Data source: Local SQLite (Transaction model)
 *
 * Note: This tests LOCAL mode history (not connected to organization).
 * For org-mode history, see historyPerformance.test.ts.
 *
 * Prerequisites:
 * - NO backend required (local SQLite only)
 */

import { expect, Page, test } from '@playwright/test';
import { closeApp, setupApp } from '../../utils/automationSupport.js';
import { resetDbState, resetDbStateForTeardown } from '../../utils/databaseUtil.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { seedLocalPerfData } from './seed-local-perf-data.js';
import {
  collectPerformanceSamples,
  DATA_VOLUMES,
  DEBUG,
  formatDuration,
  TARGET_LOAD_TIME_MS,
  TRANSACTION_ROW_SELECTOR,
  waitForRowCount,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';
import { createSeededLocalUserSession } from '../../utils/localBaseline.js';

// Volume requirement from k6 constants (SSOT)
const DB_ITEM_COUNT = DATA_VOLUMES.HISTORY;
const MIN_ROWS = 10; // Minimum rows to verify rendering

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let testEmail: string;
let seededCount: number;
let loginPage: LoginPage;

test.describe('History Page Performance (Local Mode)', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage, {
      email: `perf-history-local-${Date.now()}@test.com`,
    });
    testEmail = seededUser.email;

    const result = await seedLocalPerfData(testEmail);
    seededCount = result.history;
    expect(seededCount, 'History seeding failed').toBeGreaterThanOrEqual(DB_ITEM_COUNT);
    if (DEBUG) console.log(`Seeded ${seededCount} history transactions for performance test`);
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbStateForTeardown();
  });

  test('History tab (local mode) should load in under 1 second (p95)', async () => {
    // Navigate to Transactions menu first
    await window.click(SELECTORS.MENU_TRANSACTIONS);
    await window.waitForLoadState('networkidle');

    // Go to History tab
    await window.click(SELECTORS.PERSONAL_TAB_HISTORY);
    await window.waitForLoadState('networkidle');

    // Verify data is visible before benchmarking
    const initialRowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, MIN_ROWS, 5000);
    expect(
      initialRowCount,
      `Only ${initialRowCount} history rows rendered, need >= ${MIN_ROWS}`,
    ).toBeGreaterThanOrEqual(MIN_ROWS);
    console.log(`Initial row count: ${initialRowCount}`);

    // Collect performance samples by switching tabs
    const samples = await collectPerformanceSamples(async () => {
      // Switch away (to Drafts tab)
      await window.click(SELECTORS.TAB_DRAFTS);
      await window.waitForLoadState('networkidle');

      // Measure time to switch back to History
      const startTime = Date.now();
      await window.click(SELECTORS.PERSONAL_TAB_HISTORY);
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered during sample
      const rowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, 1, 5000);
      expect(rowCount, 'No history rows rendered during sample').toBeGreaterThan(0);

      return loadTime;
    }, 5);

    console.log(
      `History (local) p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`,
    );
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
