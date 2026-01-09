/**
 * Performance Test: Sign All Transactions (Org Mode)
 *
 * Requirement: Sign all transactions (batch) in ≤ 4 seconds
 * Data source: Backend PostgreSQL (seeded by k6:seed:all)
 *
 * Prerequisites:
 * - Backend running (docker-compose up)
 * - Run: npm run k6:seed:all (seeds 200 transactions to sign)
 * - User must have signing key configured
 *
 * IMPORTANT: This test is DESTRUCTIVE - it changes transaction state.
 * Run separately and re-seed after each run.
 *
 * Note: This test measures UI signing performance, which depends on:
 * - Private key being available in the app
 * - Transaction bytes being valid for signing
 * - Backend processing speed
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { setupApp, closeApp } from '../../utils/util.js';
import { resetDbState } from '../../utils/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import {
  formatDuration,
  waitForRowCount,
  waitForGroupRow,
  navigateToReadyToSign,
  executeSignAllWithSpinnerCheck,
  TRANSACTION_ROW_SELECTOR,
  DATA_VOLUMES,
  THRESHOLDS,
  DEBUG,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';
import { setupOrgModeTestEnvironment, refreshCachedAccountTimestamp } from './seed-org-perf-data.js';

dotenv.config();

// Thresholds and volumes from k6 constants (SSOT)
const SIGN_ALL_THRESHOLD_MS = THRESHOLDS.SIGN_ALL_MS;
const MIN_GROUP_SIZE = DATA_VOLUMES.GROUP_SIZE;

let app: ElectronApplication;
let window: Page;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;

test.describe('Sign All Performance (Org Mode)', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    organizationPage = new OrganizationPage(window);

    await setupOrgModeTestEnvironment(window, registrationPage, organizationPage, 'perf-sign-all');
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('Sign All should complete in under 4 seconds with loading indicator', async () => {
    // Pass cache refresh to navigateToReadyToSign - it will be called RIGHT BEFORE
    // clicking the Ready to Sign tab to minimize the window for Mirror Node override
    await navigateToReadyToSign(window, refreshCachedAccountTimestamp);

    const groupRow = await waitForGroupRow(window);

    const detailsButton = groupRow.locator(SELECTORS.BUTTON_DETAILS);
    await detailsButton.click();

    await window.waitForLoadState('networkidle');

    const signAllButton = window.locator(SELECTORS.BUTTON_SIGN_GROUP);
    await expect(signAllButton, 'Sign All button not found on group details page').toBeVisible({ timeout: 10000 });
    if (DEBUG) console.log('Found Sign All button on group details page');

    // STRICT: require minimum volume
    const initialCount = await waitForRowCount(window, TRANSACTION_ROW_SELECTOR, MIN_GROUP_SIZE, 15000);
    expect(initialCount, `Group has ${initialCount} txns, need >= ${MIN_GROUP_SIZE}`).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
    if (DEBUG) console.log(`Group has ${initialCount} transactions to sign`);

    const signTime = await executeSignAllWithSpinnerCheck(window, signAllButton);

    console.log(`Sign All completed in ${formatDuration(signTime)}`);

    expect(signTime).toBeLessThan(SIGN_ALL_THRESHOLD_MS);
  });
});
