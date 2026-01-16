/**
 * Performance Test: In Progress Tab (Org Mode)
 *
 * Requirement: Tab loads in ≤ 1s
 * Data source: Backend PostgreSQL (seeded by k6:seed:all)
 *
 * Note: In Progress tab shows all transactions with status WAITING_FOR_SIGNATURES
 * (same data as Ready to Sign, but without user-specific filtering)
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

// In Progress shows WAITING_FOR_SIGNATURES transactions (same as Ready to Sign)
const REQUIRED_TOTAL = DATA_VOLUMES.READY_TO_SIGN;

let app: ElectronApplication;
let window: Page;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;

test.describe('In Progress Performance (Org Mode)', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    organizationPage = new OrganizationPage(window);

    await setupOrgModeTestEnvironment(window, registrationPage, organizationPage, 'perf-in-progress');
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('In Progress tab should load in under 1 second (p95)', async () => {
    await window.click(SELECTORS.MENU_TRANSACTIONS);
    await window.waitForLoadState('networkidle');
    await window.click(SELECTORS.TAB_IN_PROGRESS);
    await window.waitForLoadState('networkidle');

    await enforceVolumeRequirement(window, REQUIRED_TOTAL, 'In Progress');

    const samples = await collectPerformanceSamples(async () => {
      await window.click(SELECTORS.TAB_HISTORY);
      await window.waitForLoadState('networkidle');

      const startTime = Date.now();
      await window.click(SELECTORS.TAB_IN_PROGRESS);
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered during sample
      const rowCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, 1, 5000);
      expect(rowCount, 'No rows rendered during sample').toBeGreaterThan(0);

      return loadTime;
    }, 5);

    console.log(
      `In Progress p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`,
    );
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
