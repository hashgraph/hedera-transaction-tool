import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
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

test.describe('Transaction node form tests @local-transactions', () => {
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
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify user can open the Node Create transaction form', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnNodeServiceLink();
    await transactionPage.clickOnNodeCreateTransaction();

    const headingText = await transactionPage.getTransactionTypeHeaderText();
    expect(headingText).toBe('Node Create Transaction');
  });

  test('Verify user can open the Node Update transaction form', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnNodeServiceLink();
    await transactionPage.clickOnNodeUpdateTransaction();

    const headingText = await transactionPage.getTransactionTypeHeaderText();
    expect(headingText).toBe('Node Update Transaction');
  });

  test('Verify user can open the Node Delete transaction form', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnNodeServiceLink();
    await transactionPage.clickOnNodeDeleteTransaction();

    const headingText = await transactionPage.getTransactionTypeHeaderText();
    expect(headingText).toBe('Node Delete Transaction');
  });
});
