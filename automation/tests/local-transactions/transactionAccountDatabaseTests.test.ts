import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction account database and card tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify transaction is stored in the local database for account create tx', async () => {
    const transactionPage = suite.transactionPage;
    const { newTransactionId } = await transactionPage.createNewAccount();

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      newTransactionId ?? '',
      'Account Create Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is stored in the local database for account create tx', async () => {
    const transactionPage = suite.transactionPage;
    const { newAccountId } = await transactionPage.createNewAccount();
    await transactionPage.clickOnAccountsMenuButton();
    const isTxExistingInDb = await transactionPage.verifyAccountExists(newAccountId ?? '');
    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is displayed in the account card section', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.clickOnAccountsMenuButton();
    const isAccountVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isAccountVisible).toBe(true);
  });
});
