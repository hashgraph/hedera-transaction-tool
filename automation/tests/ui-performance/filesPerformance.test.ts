/**
 * Performance Test: Files Page
 *
 * Requirement: 100 files in DB, page load (50 visible) in ≤ 1s
 * Data source: Local SQLite (HederaFile model)
 *
 * Note: UI paginates at max 50 items per page.
 */

import { expect, Page, test } from '@playwright/test';
import { closeApp, setupApp } from '../../utils/automationSupport.js';
import { resetDbState } from '../../utils/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { seedLocalPerfData } from './seed-local-perf-data.js';
import {
  collectPerformanceSamples,
  DATA_VOLUMES,
  DEBUG,
  formatDuration,
  TARGET_LOAD_TIME_MS,
  TEST_LOCAL_PASSWORD,
  waitForRowCount,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';

// Volume requirement from k6 constants (SSOT)
const DB_ITEM_COUNT = DATA_VOLUMES.FILES;
const MIN_ROWS = 50; // Strict: require at least 50 rows rendered

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let registrationPage: RegistrationPage;
let testEmail: string;
let seededCount: number;

test.describe('Files Page Performance', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);

    testEmail = `perf-files-${Date.now()}@test.com`;
    await registrationPage.completeRegistration(testEmail, TEST_LOCAL_PASSWORD);

    const result = await seedLocalPerfData(testEmail);
    seededCount = result.files;
    expect(seededCount, 'Seeding failed').toBeGreaterThanOrEqual(DB_ITEM_COUNT);
    if (DEBUG) console.log(`Seeded ${seededCount} files for performance test`);
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('Files page should load in under 1 second (p95)', async () => {
    const samples = await collectPerformanceSamples(async () => {
      await window.click(SELECTORS.MENU_TRANSACTIONS);
      await window.waitForLoadState('networkidle');

      const startTime = Date.now();
      await window.click(SELECTORS.MENU_FILES);
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered (STRICT: require minimum volume)
      const rowCount = await waitForRowCount(window, SELECTORS.FILE_ROW, MIN_ROWS, 5000);
      expect(rowCount, `Only ${rowCount} files rendered, need >= ${MIN_ROWS}`).toBeGreaterThanOrEqual(MIN_ROWS);

      return loadTime;
    }, 5);

    console.log(`Files p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`);
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
