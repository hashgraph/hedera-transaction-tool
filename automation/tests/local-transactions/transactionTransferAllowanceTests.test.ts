import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
import { Transaction } from '../../../front-end/src/shared/interfaces/index.js';
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

test.describe('Transaction transfer and allowance execution tests @local-transactions', () => {
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

  test('Verify user can execute transfer tokens tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = 1;
    const transactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred.toString(),
    );

    const transactionDetails: Transaction = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const allTransfer = transactionDetails?.transfers;
    const amount = allTransfer.find(acc => acc.account === accountFromList)?.amount;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOTRANSFER');
    expect(amount).toBe(amountToBeTransferred * 100000000);
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can add the rest of remaining hbars to receiver accounts', async () => {
    const amountToBeTransferred = 10;
    const amountLeftForRestAccounts = 9;
    await transactionPage.ensureAccountExists();
    const receiverAccount = await transactionPage.getFirstAccountFromList();
    await loginPage.waitForToastToDisappear();

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnTransferTokensTransaction();
    await transactionPage.fillInTransferFromAccountId();
    await transactionPage.fillInTransferAmountFromAccount(amountToBeTransferred.toString());
    await transactionPage.fillInTransferToAccountId(receiverAccount);
    await transactionPage.clickOnAddTransferFromButton();
    await transactionPage.fillInTransferAmountToAccount(
      (amountToBeTransferred - amountLeftForRestAccounts).toString(),
    );
    await transactionPage.clickOnAddTransferToButton();

    await transactionPage.fillInTransferToAccountId(await transactionPage.getPayerAccountId());
    await transactionPage.clickOnAddRestButton();

    // Get HBAR amounts for the two accounts and verify rest is added up
    const amounts = await transactionPage.getHbarAmountValueForTwoAccounts();
    const firstReceiverAmount = amounts?.split(',')[0] ?? '';
    const secondReceiverAmount = amounts?.split(',')[1] ?? '';
    expect(firstReceiverAmount).toContain(
      (amountToBeTransferred - amountLeftForRestAccounts).toString(),
    );
    expect(secondReceiverAmount).toContain(amountLeftForRestAccounts.toString());
  });

  test('Verify sign button is disabled when receiver amount is higher than payer amount when doing transfer tx', async () => {
    await transactionPage.ensureAccountExists();
    const receiverAccount = await transactionPage.getFirstAccountFromList();
    await loginPage.waitForToastToDisappear();

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnTransferTokensTransaction();
    await transactionPage.fillInTransferFromAccountId();
    await transactionPage.fillInTransferAmountFromAccount('10');
    await transactionPage.fillInTransferToAccountId(receiverAccount);
    await transactionPage.clickOnAddTransferFromButton();
    await transactionPage.fillInTransferAmountToAccount('200');
    await transactionPage.clickOnAddTransferToButton();

    const isButtonEnabled = await transactionPage.isSignAndSubmitButtonEnabled();
    expect(isButtonEnabled).toBe(false);
  });

  test('Verify user can execute approve allowance tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const transactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(result).toBe('SUCCESS');

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      transactionId ?? '',
      'Account Allowance Approve Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });
});
