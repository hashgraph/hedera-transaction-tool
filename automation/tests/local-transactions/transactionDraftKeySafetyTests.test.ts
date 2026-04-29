import { test } from '@playwright/test';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction draft key safety tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify that deleting all keys prevent to sign and execute a draft transaction', async () => {
    // This test is a copy of organizationSettingsTests.test.ts 'Verify that deleting all keys prevent to sign and execute a draft transaction'
    // If you fix something here, you probably want to do the same in organizationSettingsTests.test.ts

    // Go to Settings / Keys and delete all keys
    const settingsPage = new SettingsPage(suite.window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnSelectAllKeys();
    await settingsPage.clickOnDeleteKeyAllButton();
    await settingsPage.clickOnDeleteKeyPairButton();

    // Go to Transactions and fill a new Account Update transaction
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnUpdateAccountTransaction();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await suite.transactionPage.fillInPayerAccountId('0.0.1002');
    await suite.transactionPage.fillInMaxAutoAssociations('0'); // Workaround for -1 bug in maxAutoAssociations
    await suite.transactionPage.fillInUpdatedAccountId('0.0.1002'); // Called last because it waits for sign and submit activation

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await suite.transactionPage.clickOnSignAndSubmitButton();
    await suite.transactionPage.clickOnSaveGotoSettings();
    await settingsPage.verifySettingsElements();

    // Go back to Transactions / Drafts
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnDraftsMenuButton();

    // Click Continue to edit draft transaction
    await suite.transactionPage.clickOnFirstDraftContinueButton();

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await new Promise(resolve => setTimeout(resolve, 250));
    await suite.transactionPage.clickOnSignAndSubmitButton();
    await suite.transactionPage.clickOnGotoSettings();
    await settingsPage.verifySettingsElements();
  });
});
