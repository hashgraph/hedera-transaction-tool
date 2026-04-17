import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { DetailsPage } from '../../pages/DetailsPage.js';
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
let detailsPage: DetailsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Workflow history/detail account and transfer tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    detailsPage = new DetailsPage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify account create tx is displayed in history page', async () => {
    const txDescription = 'test account create tx description';
    const { newTransactionId } = await transactionPage.createNewAccount({
      description: txDescription,
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Create',
      txDescription,
    );
  });

  test('Verify transaction details are displayed for account tx ', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount({
      description: 'testDescription',
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Create',
    );
    const getAccountDetailsKey = await detailsPage.getAccountDetailsKey();
    expect(getAccountDetailsKey).toBeTruthy();

    const getAccountDetailsStaking = await detailsPage.getAccountDetailsStaking();
    expect(getAccountDetailsStaking).toBe('None');

    const getAccountDetailsAcceptRewards = await detailsPage.getAccountDetailsAcceptRewards();
    expect(getAccountDetailsAcceptRewards).toBe('Yes');

    const getAccountDetailsReceiverSigRequired =
      await detailsPage.getAccountDetailsReceiverSigRequired();
    expect(getAccountDetailsReceiverSigRequired).toBe('No');

    const getAccountDetailsInitialBalance = await detailsPage.getAccountDetailsInitBalance();
    expect(getAccountDetailsInitialBalance).toBe('0 ℏ');

    const getTransactionDescription = await detailsPage.getTransactionDescription();
    expect(getTransactionDescription).toBe('testDescription');
  });

  test('Verify transaction details are displayed for account update tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Update',
    );
    const getTransactionMemo = await detailsPage.getTransactionDetailsMemo();
    expect(getTransactionMemo).toBe('Transaction memo update');

    const getAccountId = await detailsPage.getAccountUpdateDetailsId();
    expect(getAccountId).toContain(accountFromList);

    const getAccountMemoDetails = await detailsPage.getAccountDetailsMemo();
    expect(getAccountMemoDetails).toBe(updatedMemoText);
  });

  test('Verify account update tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo again';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Update',
    );
  });

  test('Verify account delete tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Delete',
    );
  });

  test('Verify transaction details are displayed for account delete tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Delete',
    );
    const getDeletedAccountId = await detailsPage.getDeletedAccountId();
    expect(getDeletedAccountId).toContain(accountFromList);

    const getTransferAccountId = await detailsPage.getAccountDeleteDetailsTransferId();
    expect(getTransferAccountId).toBeTruthy();
  });

  test('Verify transfer tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Transfer');
  });

  test('Verify transaction details are displayed for transfer tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Transfer',
    );
    const transferDetailsFromAccount = await detailsPage.getTransferDetailsFromAccount();
    expect(transferDetailsFromAccount).toBeTruthy();

    const transferDetailsFromAmount = await detailsPage.getTransferDetailsFromAmount();
    expect(transferDetailsFromAmount).toContain('-' + amountToBeTransferred + ' ℏ');

    const transferDetailsToAccount = await detailsPage.getTransferDetailsToAccount();
    expect(transferDetailsToAccount).toContain(accountFromList);

    const transferDetailsToAmount = await detailsPage.getTransferDetailsToAmount();
    expect(transferDetailsToAmount).toContain(amountToBeTransferred + ' ℏ');
  });

  test('Verify approve allowance tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Allowance Approve',
    );
  });

  test('Verify transaction details are displayed for approve allowance tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Allowance Approve',
    );
    const allowanceOwnerAccount = await detailsPage.getAllowanceDetailsOwnerAccount();
    expect(allowanceOwnerAccount).toBeTruthy();

    const allowanceSpenderAccount = await detailsPage.getAllowanceDetailsSpenderAccount();
    expect(allowanceSpenderAccount).toContain(accountFromList);

    const allowanceAmount = await detailsPage.getAllowanceDetailsAmount();
    expect(allowanceAmount).toContain(amountToBeApproved + ' ℏ');
  });

});
