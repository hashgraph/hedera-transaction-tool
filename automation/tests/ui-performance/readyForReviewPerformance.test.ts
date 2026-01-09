/**
 * Performance Test: Ready for Review Tab (Org Mode)
 *
 * Requirement: Tab loads in ≤ 1s
 * Data source: Backend PostgreSQL (seeded by k6:seed:all)
 *
 * Prerequisites:
 * - Backend running (docker-compose up)
 * - Run: npm run k6:seed:all
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { setupApp, closeApp } from '../../utils/util.js';
import { resetDbState } from '../../utils/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import {
  TARGET_LOAD_TIME_MS,
  collectPerformanceSamples,
  formatDuration,
  waitForRowCount,
  enforceVolumeRequirement,
  TRANSACTION_ROW_SELECTOR,
  DATA_VOLUMES,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';
import { setupOrgModeTestEnvironment } from './seed-org-perf-data.js';

dotenv.config();

// Volume requirement from k6 constants (SSOT)
const REQUIRED_TOTAL = DATA_VOLUMES.READY_FOR_REVIEW;

let app: ElectronApplication;
let window: Page;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;

test.describe('Ready for Review Performance (Org Mode)', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    organizationPage = new OrganizationPage(window);

    await setupOrgModeTestEnvironment(window, registrationPage, organizationPage, 'perf-ready-for-review');
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('Ready for Review tab should load in under 1 second (p95)', async () => {
    await window.click(SELECTORS.MENU_TRANSACTIONS);
    await window.waitForLoadState('networkidle');
    await Promise.all([
      window.waitForResponse(
        (res) =>
          res.url().includes('/transaction-nodes') ||
          res.url().includes('/transactions/approve'),
        { timeout: 10000 }
      ),
      window.click(SELECTORS.TAB_READY_FOR_REVIEW),
    ]);
    await window.waitForLoadState('networkidle');

    await enforceVolumeRequirement(window, REQUIRED_TOTAL, 'Ready for Review');

    const samples = await collectPerformanceSamples(async () => {
      await window.click(SELECTORS.TAB_HISTORY);
      await window.waitForLoadState('networkidle');

      const startTime = Date.now();
      await window.click(SELECTORS.TAB_READY_FOR_REVIEW);
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered during sample (consistency with local-mode tests)
      const rowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, 1, 5000);
      expect(rowCount, 'No rows rendered during sample').toBeGreaterThan(0);

      return loadTime;
    }, 5);

    console.log(
      `Ready for Review p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`,
    );
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
