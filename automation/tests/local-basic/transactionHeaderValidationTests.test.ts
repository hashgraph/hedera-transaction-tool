import { Page, expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
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
let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

const INVALID_PAYER_ID = 'not-an-account-id';
const ZERO_MAX_FEE = '0';
const OVERLONG_MEMO = 'a'.repeat(101);
const MEMO_OVERFLOW_TOAST = 'Transaction Memo is limited to 100 characters';

test.describe('Transaction header validation tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    transactionPage = new TransactionPage(window);
    await createSeededLocalUserSession(window, loginPage);
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await transactionPage.openCreateAccountForm();
  });

  // 5.14.6: Sign disabled when Payer Account ID does not parse as an account ID.
  test('Verify Sign button is disabled when Payer ID is invalid', async () => {
    await transactionPage.fillInPayerAccountId(INVALID_PAYER_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.14.7: Memo > 100 chars surfaces as toast and marks the field invalid.
  test('Verify memo exceeding 100 characters shows error toast and marks field invalid', async () => {
    await transactionPage.fillInTransactionMemoBypassingMaxLength(OVERLONG_MEMO);
    await registrationPage.waitForToastMessageByVariant('error', MEMO_OVERFLOW_TOAST);
    expect(await transactionPage.isTransactionMemoMarkedInvalid()).toBe(true);
  });

  // 5.14.8: Sign disabled when Max Transaction Fee is 0.
  test('Verify Sign button is disabled when Max Transaction Fee is 0', async () => {
    await transactionPage.fillInMaxTransactionFee(ZERO_MAX_FEE);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });
});
