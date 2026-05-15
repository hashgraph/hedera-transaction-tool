import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction account delete tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify user can execute account delete tx', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const transactionId = await transactionPage.deleteAccount(accountFromList);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId!);
    const transactionType = transactionDetails?.name;
    const deletedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;

    expect(transactionType).toBe('CRYPTODELETE');
    expect(deletedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');
  });

  test('Account delete validation blocks submit for deleted accounts and malformed transfer account IDs', async () => {
    let transactionPage = suite.transactionPage;
    const { newAccountId: accountA } = await transactionPage.createNewAccount({
      description: 'delete-validation-A',
    });
    const { newAccountId: accountB } = await transactionPage.createNewAccount({
      description: 'delete-validation-B',
    });

    expect(accountA).toBeTruthy();
    expect(accountB).toBeTruthy();

    await transactionPage.deleteAccount(accountA!);
    await transactionPage.waitForMirrorAccountDeleted(accountA!);

    // Reload clears the in-memory account info cache so the delete form fetches
    // the post-delete mirror-node state without requiring app code changes.
    await suite.reloadSession();
    transactionPage = suite.transactionPage;

    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnDeleteAccountTransaction();

    const payerAccountId = (await transactionPage.getPayerAccountId()) || '0.0.1002';
    await transactionPage.fillInTransferAccountIdAndBlur(payerAccountId);

    // 5.4.8 + 5.4.10: Deleted account shows inline warning and blocks submit.
    await transactionPage.fillInDeletedAccountIdAndBlur(accountA!);
    expect(await transactionPage.isAccountAlreadyDeletedWarningVisible()).toBe(true);
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);

    // Switch to a non-deleted account so we can exercise transfer-id validation.
    await transactionPage.fillInDeletedAccountId(accountB!);
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);

    // 5.4.9: Invalid Transfer Account ID blocks submit.
    await transactionPage.fillMalformedTransferAccountIdAndBlur();
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);

    // 5.4.10: Transfer-to deleted account blocks submit.
    await transactionPage.fillInTransferAccountIdAndBlur(accountA!);
    expect(await transactionPage.isAccountAlreadyDeletedWarningVisible()).toBe(true);
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify account is deleted from the db after account delete tx', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);
    const isTxExistingInDb = await transactionPage.verifyAccountExists(accountFromList);
    expect(isTxExistingInDb).toBe(false);
  });

  test('Verify account id is removed from the account cards after account delete tx', async () => {
    const transactionPage = suite.transactionPage;
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnAccountsMenuButton();
    const isAccountHidden = await transactionPage.isAccountCardHidden(accountFromList);
    expect(isAccountHidden).toBe(true);
  });
});
