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

test.describe('Transaction system delete and undelete tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
  });

  // 5.11.3
  test('Verify user can open the System Delete transaction form', async () => {
    await createSeededLocalUserSession(window, loginPage);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnSystemDeleteTransaction();

    await expect(
      transactionPage.getElement(transactionPage.transactionTypeHeaderSelector),
    ).toContainText('System Delete');

    await transactionPage.fill('input-file-id-for-update', '0.0.111');
    await transactionPage.fill('input-contract-id', '0.0.222');

    await expect(
      transactionPage.getElement(transactionPage.signAndSubmitButtonSelector),
    ).toBeVisible();
  });

  // 5.11.4
  test('Verify user can open the System Undelete transaction form', async () => {
    await createSeededLocalUserSession(window, loginPage);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnSystemUndeleteTransaction();

    await expect(
      transactionPage.getElement(transactionPage.transactionTypeHeaderSelector),
    ).toContainText('System Undelete');

    await transactionPage.fill('input-file-id-for-update', '0.0.111');
    await transactionPage.fill('input-contract-id', '0.0.222');

    await expect(
      transactionPage.getElement(transactionPage.signAndSubmitButtonSelector),
    ).toBeVisible();
  });
});
