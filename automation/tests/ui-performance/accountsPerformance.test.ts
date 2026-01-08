/**
 * Performance Test: Accounts Page
 *
 * Requirement: 100 accounts in DB, page load (50 visible) in ≤ 1s
 * Data source: Local SQLite (HederaAccount model)
 *
 * Note: UI paginates at max 50 items per page.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { setupApp, closeApp } from '../../utils/util.js';
import { resetDbState } from '../../utils/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { seedLocalPerfData } from './seed-local-perf-data.js';
import {
  TARGET_LOAD_TIME_MS,
  collectPerformanceSamples,
  waitForRowCount,
  formatDuration,
  DATA_VOLUMES,
  DEBUG,
  TEST_LOCAL_PASSWORD,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';

// Volume requirement from k6 constants (SSOT)
const DB_ITEM_COUNT = DATA_VOLUMES.ACCOUNTS;
const MIN_ROWS = 50; // Strict: require at least 50 rows rendered

let app: ElectronApplication;
let window: Page;
let registrationPage: RegistrationPage;
let testEmail: string;
let seededCount: number;

test.describe('Accounts Page Performance', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);

    testEmail = `perf-accounts-${Date.now()}@test.com`;
    const password = TEST_LOCAL_PASSWORD;
    await registrationPage.completeRegistration(testEmail, password);

    const result = await seedLocalPerfData(testEmail);
    seededCount = result.accounts;
    expect(seededCount, 'Seeding failed').toBeGreaterThanOrEqual(DB_ITEM_COUNT);
    if (DEBUG) console.log(`Seeded ${seededCount} accounts for performance test`);
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('Accounts page should load in under 1 second (p95)', async () => {
    const samples = await collectPerformanceSamples(async () => {
      await window.click(SELECTORS.MENU_TRANSACTIONS);
      await window.waitForLoadState('networkidle');

      const startTime = Date.now();
      await window.click(SELECTORS.MENU_ACCOUNTS);
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered (STRICT: require minimum volume)
      const rowCount = await waitForRowCount(window, SELECTORS.ACCOUNT_ROW, MIN_ROWS, 5000);
      expect(rowCount, `Only ${rowCount} accounts rendered, need >= ${MIN_ROWS}`).toBeGreaterThanOrEqual(MIN_ROWS);

      return loadTime;
    }, 5);

    console.log(`Accounts p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`);
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
