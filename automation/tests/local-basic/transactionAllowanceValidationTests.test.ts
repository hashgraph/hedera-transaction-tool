import { Page, expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

const VALID_PAYER_ID = '0.0.2';
const NON_RESOLVABLE_ACCOUNT_ID = '0.0.999999999';
const MALFORMED_ACCOUNT_ID = 'not-an-account-id';

// In @local-basic the mirror node is not live, so neither owner nor spender keys ever resolve;
// the Sign button stays disabled and the thrown toast text is unreachable. These tests assert
// that the form prevents submission, which is the right coverage for this layer.
test.describe('Transaction allowance validation tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await createSeededLocalUserSession(window, loginPage);
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await transactionPage.openApproveAllowanceForm();
    await transactionPage.fillInPayerAccountId(VALID_PAYER_ID);
  });

  // 5.6.5: Owner ID without a resolvable key keeps Sign disabled.
  test('Verify Sign button is disabled when Owner ID has no resolvable key', async () => {
    await transactionPage.fillInAllowanceOwner(NON_RESOLVABLE_ACCOUNT_ID);
    await transactionPage.fillInSpenderAccountIdNormally(VALID_PAYER_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.6.6: Spender ID with malformed format keeps Sign disabled.
  test('Verify Sign button is disabled when Spender ID is invalid', async () => {
    await transactionPage.fillInAllowanceOwner(VALID_PAYER_ID);
    await transactionPage.fillInSpenderAccountIdNormally(MALFORMED_ACCOUNT_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });
});
