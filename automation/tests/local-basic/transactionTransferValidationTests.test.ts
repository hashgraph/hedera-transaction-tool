import { expect, Page, test } from '@playwright/test';
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

const PAYER_ACCOUNT = '0.0.2';
const RECEIVER_ACCOUNT = '0.0.3';

test.describe('Transaction transfer validation tests @local-basic', () => {
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
  });

  // 5.5.9: `Total balance adjustments must be greater than 0` — surfaces as Sign disabled when no transfers added.
  test('Verify Sign button is disabled when no transfers are added', async () => {
    await transactionPage.openTransferForm();
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.5.7: `The balance difference must be 0` — surfaces as Sign disabled when from/to amounts do not sum to zero.
  test('Verify Sign button is disabled when from/to amounts do not sum to zero', async () => {
    await transactionPage.openTransferForm();
    await transactionPage.fillInTransferFromAccountId(PAYER_ACCOUNT);
    await transactionPage.fillInTransferAmountFromAccount('10');
    await transactionPage.fillInTransferToAccountId(RECEIVER_ACCOUNT);
    await transactionPage.clickOnAddTransferFromButton();
    await transactionPage.fillInTransferAmountToAccount('5');
    await transactionPage.clickOnAddTransferToButton();
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.5.11 (and structurally 5.5.8): Add Transfer buttons are disabled when 10 adjustments already added.
  test('Verify Add Transfer buttons are disabled when 10 adjustments are already added', async () => {
    await transactionPage.openTransferForm();
    // Each pair adds one debit + one credit, so 5 pairs reach the 10-adjustment cap.
    await transactionPage.addBalancedTransferAdjustments(PAYER_ACCOUNT, RECEIVER_ACCOUNT, 5);
    expect(await transactionPage.isAddTransferFromButtonEnabled()).toBe(false);
    expect(await transactionPage.isAddTransferToButtonEnabled()).toBe(false);
  });
});
