import { expect, test } from '@playwright/test';
import { setupOrganizationSettingsGeneralSuite } from '../helpers/fixtures/organizationSettingsGeneralSuite.js';

test.describe('Organization Settings transaction access tests @organization-basic', () => {
  const suite = setupOrganizationSettingsGeneralSuite();

  test('Verify that tabs on Transaction page are visible', async () => {
    await suite.transactionPage.clickOnTransactionsMenuButton();
    expect(await suite.organizationPage.returnAllTabsVisible()).toBe(true);
  });

  test('Verify "Import Signatures from File" option is available in organization mode', async () => {
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnTransactionFileActionsDropdown();
    const isVisible = await suite.transactionPage.isImportSignaturesFromFileOptionVisible();
    expect(isVisible).toBe(true);
  });

  test('Verify that deleting all keys prevent to sign and execute a draft transaction', async () => {
    // This test is a copy of transactionTests.test.ts 'Verify that deleting all keys prevent to sign and execute a draft transaction'
    // If you fix something here, you probably want to do the same in transactionTests.test.ts

    // Go to Settings / Keys and delete all keys
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnSelectAllKeys();
    await suite.settingsPage.clickOnDeleteKeyAllButton();
    await suite.settingsPage.clickOnDeleteKeyPairButton();

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
    await suite.settingsPage.verifySettingsElements();

    // Go back to Transactions / Drafs
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnDraftsMenuButton();

    // Click Continue to edit draft transaction
    await suite.transactionPage.clickOnFirstDraftContinueButton();

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await new Promise(resolve => setTimeout(resolve, suite.transactionPage.getShortTimeout()));
    await suite.transactionPage.clickOnSignAndSubmitButton();
    await suite.transactionPage.clickOnGotoSettings();
    await suite.settingsPage.verifySettingsElements();
  });
});
