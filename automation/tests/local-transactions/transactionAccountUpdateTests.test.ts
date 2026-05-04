import { expect, test } from '@playwright/test';
import { getOperatorKeyEnv } from '../../utils/runtime/environment.js';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction account update tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify sign button is disabled when no account ID is entered', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Malformed account ID disables signing on account update', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();

    await transactionPage.fillMalformedUpdateAccountIdAndBlur();

    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify that account is updated after we execute an account update tx', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '-1';
    const transactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');

    const accountDetails = await transactionPage.mirrorGetAccountResponse(accountFromList);

    const memoFromResponse = accountDetails.accounts[0]?.memo;
    expect(memoFromResponse).toBe(updatedMemoText);

    const maxAutoAssocFromResponse =
      accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssocFromResponse.toString()).toBe(maxAutoAssociationsNumber);
  });

  test('Verify that system account can be updated without account key using a superUser as the fee payer', async () => {
    await suite.setupTransactionEnvironment(getOperatorKeyEnv());
    const transactionPage = suite.transactionPage;
    const newPublicKey = await transactionPage.generateRandomPublicKey();
    const transactionId = await transactionPage.updateAccountKey('0.0.100', newPublicKey, '0.0.2');

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe('0.0.100');
    expect(result).toBe('SUCCESS');
  });
});
