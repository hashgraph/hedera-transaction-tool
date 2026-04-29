import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction account create validation tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify that all elements on account create page are correct', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    const allElementsAreVisible = await transactionPage.verifyAccountCreateTransactionElements();
    expect(allElementsAreVisible).toBe(true);
  });

  test('Verify sign button is disabled when no owner key is selected', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.fillInPublicKeyForAccount('');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify account create staking validation blocks signing and initial balance resets when exceeding payer balance', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();

    // Ensure payer info is present so the Initial Balance watcher can clamp the value.
    const payerAccountId = (await transactionPage.getPayerAccountId()) || '0.0.1002';
    await transactionPage.fillInPayerAccountId(payerAccountId);
    await transactionPage.blurPayerAccountId();

    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);

    // 5.2.16: Initial balance auto-resets to 0 when it exceeds payer's available balance.
    await transactionPage.fillInInitialFundsAndBlur('999999999999');
    await expect.poll(async () => transactionPage.getInitialFundsValue()).toBe('0');

    // 5.2.15: Invalid Staked Account ID format disables the sign button.
    await transactionPage.selectStaking('Account');
    await transactionPage.fillMalformedStakedAccountIdAndBlur();
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);

    // Reset staking -> sign button should re-enable.
    await transactionPage.selectStaking('None');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);
  });

  test('Verify confirm transaction modal is displayed with valid information for Account Create tx', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    await transactionPage.clickOnSignAndSubmitButton();
    const confirmTransactionIsDisplayedAndCorrect =
      await transactionPage.verifyConfirmTransactionInformation('Account Create Transaction');
    await transactionPage.clickOnCancelTransaction();
    expect(confirmTransactionIsDisplayedAndCorrect).toBe(true);
  });
});
