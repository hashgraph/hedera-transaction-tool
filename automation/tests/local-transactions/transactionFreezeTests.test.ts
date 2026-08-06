import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction freeze tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify user can open the Freeze transaction form', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFreezeTransaction();

    const heading = await transactionPage.getTransactionTypeHeaderText();
    expect(heading).toContain('Freeze');

    const isSignButtonVisible = await transactionPage.isSignAndSubmitButtonVisible();
    expect(isSignButtonVisible).toBe(true);
  });
});
