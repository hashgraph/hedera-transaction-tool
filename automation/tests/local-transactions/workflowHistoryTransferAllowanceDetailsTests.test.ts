import { expect, test } from '@playwright/test';
import { DetailsPage } from '../../pages/DetailsPage.js';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Workflow history/detail transfer and allowance tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();
  let detailsPage: DetailsPage;

  test.beforeEach(async () => {
    detailsPage = new DetailsPage(suite.window);
  });

  test('Verify transfer tx is displayed in history page', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await suite.transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Transfer');
  });

  test('Verify transaction details are displayed for transfer tx', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await suite.transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Transfer');
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
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await suite.transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Allowance Approve',
    );
  });

  test('Verify transaction details are displayed for approve allowance tx', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await suite.transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Allowance Approve');
    const allowanceOwnerAccount = await detailsPage.getAllowanceDetailsOwnerAccount();
    expect(allowanceOwnerAccount).toBeTruthy();

    const allowanceSpenderAccount = await detailsPage.getAllowanceDetailsSpenderAccount();
    expect(allowanceSpenderAccount).toContain(accountFromList);

    const allowanceAmount = await detailsPage.getAllowanceDetailsAmount();
    expect(allowanceAmount).toContain(amountToBeApproved + ' ℏ');
  });
});
