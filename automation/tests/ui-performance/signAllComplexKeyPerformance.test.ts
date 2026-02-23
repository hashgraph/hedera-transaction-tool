/**
 * Performance Test: Sign All with Complex Threshold Keys (Org Mode)
 *
 * Requirement: Sign all transactions (batch) in ≤ 4 seconds with complex threshold keys
 * Data source: PostgreSQL with multiple user_key entries for complex key signing
 *
 * Key Finding: The app DOES support multiple keys per user for signing.
 * - Database has one-to-many User → KeyPair/user_key relationship
 * - signTransaction() loops through ALL required keys and signs with each
 * - We can seed 17+ keys directly into user_key table
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { setupApp, closeApp } from '../../utils/util.js';
import { resetDbState, resetPostgresDbState } from '../../utils/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import {
  formatDuration,
  waitForGroupRow,
  navigateToReadyToSign,
  executeSignAllWithSpinnerCheck,
  THRESHOLDS,
  DEBUG,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';
import {
  setupComplexKeyTestEnvironment,
  refreshCachedAccountTimestamp,
  type ComplexKeySetupResult,
} from './seed-org-perf-data.js';

dotenv.config();

const SIGN_ALL_THRESHOLD_MS = THRESHOLDS.SIGN_ALL_MS;

/**
 * Check if running on staging and fail fast if complex key config is missing.
 * This prevents confusing failures when staging setup wasn't completed.
 */
function validateStagingConfig(): void {
  const isStaging = process.env.HEDERA_NETWORK === 'testnet' ||
                    process.env.ORGANIZATION_URL?.includes('staging');

  if (!isStaging) {
    // Localnet - no special config needed, keys generated on-the-fly
    return;
  }

  const requiredVars = ['COMPLEX_KEY_ACCOUNT_ID', 'COMPLEX_KEY_PRIVATE_KEYS'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Staging environment detected but complex key config missing!\n\n` +
      `Missing environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Run the bootstrap script first:\n` +
      `  OPERATOR_ID=<your-account> OPERATOR_KEY=<your-key> \\\n` +
      `  npx tsx k6/helpers/create-complex-accounts.ts --setup --staging\n\n` +
      `Then set the output env vars in your CI secrets.`
    );
  }

  console.log(`Staging mode: Using pre-created account ${process.env.COMPLEX_KEY_ACCOUNT_ID}`);
}

let app: ElectronApplication;
let window: Page;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;

/**
 * Integration test for Sign All with complex threshold keys
 * Requires: Backend running (docker-compose up)
 *
 * This test seeds multiple keys into PostgreSQL and creates transactions
 * requiring complex threshold key signatures.
 */
test.describe('Sign All with Complex Threshold Keys (Org Mode)', () => {
  let complexKeyResult: ComplexKeySetupResult | null = null;

  test.beforeAll(async () => {
    validateStagingConfig();

    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    organizationPage = new OrganizationPage(window);

    complexKeyResult = await setupComplexKeyTestEnvironment(
      window,
      registrationPage,
      organizationPage,
      'perf-complex-key',
      false, // useHederaStyle - set to true for full 72-key test
    );

    console.log(`Complex key setup complete:`);
    console.log(`  Keys: ${complexKeyResult.userKeyIds.length}`);
    console.log(`  Transactions: ${complexKeyResult.transactionIds.length}`);
  });

  test.afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Sign All with complex threshold key completes in under 4 seconds with loading indicator', async () => {
    expect(complexKeyResult, 'Complex key setup failed').not.toBeNull();

    const { complexKey } = complexKeyResult!;

    if (DEBUG) {
      console.log(`Testing with ${complexKey.metadata.totalKeys} keys`);
      console.log(`Structure: THRESHOLD (${complexKey.metadata.parentThreshold} of ${complexKey.metadata.childCount})`);
    }

    // Pass cache refresh to navigateToReadyToSign - called RIGHT BEFORE API call
    await navigateToReadyToSign(window, refreshCachedAccountTimestamp);

    const groupRow = await waitForGroupRow(window);

    const detailsButton = groupRow.locator(SELECTORS.BUTTON_DETAILS);
    await detailsButton.click();
    await window.waitForLoadState('networkidle');

    const signAllButton = window.locator(SELECTORS.BUTTON_SIGN_GROUP);
    await expect(signAllButton, 'Sign All button not found').toBeVisible({ timeout: 10000 });

    const signTime = await executeSignAllWithSpinnerCheck(window, signAllButton);

    console.log(`Sign All (complex key) completed in ${formatDuration(signTime)}`);
    console.log(`Keys used: ${complexKey.metadata.parentThreshold} signatures from ${complexKey.metadata.totalKeys} keys`);

    expect(signTime).toBeLessThan(SIGN_ALL_THRESHOLD_MS);
  });
});
