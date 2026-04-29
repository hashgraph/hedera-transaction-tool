import { expect, test } from '@playwright/test';
import { setupGroupTransactionSuite } from '../helpers/fixtures/groupTransactionSuite.js';

test.describe('Group transaction validation tests @local-transactions', () => {
  const suite = setupGroupTransactionSuite();

  test('Verify group transaction elements', async () => {
    const isAllElementsPresent = await suite.groupPage.verifyGroupElements();
    expect(isAllElementsPresent).toBe(true);
    expect(await suite.groupPage.isEmptyTransactionTextVisible()).toBe(true);
    expect(await suite.groupPage.getEmptyTransactionText()).toContain('There are no Transactions');
  });

  test('Verify that empty group and empty transaction is not saved', async () => {
    await suite.groupPage.clickOnAddTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    // If we click immediatly on back button, then Add To Group button appears
    // If we wait a bit, then no save dialog => we wait a bit :(
    await new Promise(resolve => setTimeout(resolve, 1000));
    await suite.transactionPage.clickOnBackButton();
    await suite.groupPage.clickOnBackButton();

    //verify no transaction group is saved
    await suite.transactionPage.navigateToDrafts();
    const isContinueButtonHidden = await suite.transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify delete group action does not save the group', async () => {
    await suite.groupPage.fillDescription('test');

    //attempt to leave the transaction group page
    await suite.transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to delete the group
    await suite.groupPage.clickOnDeleteGroupButton();

    //verify transaction group is not saved
    await suite.transactionPage.navigateToDrafts();
    const isContinueButtonHidden = await suite.transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify continue editing action saves the group', async () => {
    await suite.groupPage.fillDescription('test');

    //attempt to leave the transaction group page
    await suite.transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to continue editing
    await suite.groupPage.clickOnContinueEditingButton();

    //verify user is still at tx group page
    expect(await suite.groupPage.isDeleteModalHidden()).toBe(true);
    expect(await suite.groupPage.verifyGroupElements()).toBe(true);
  });

  test('Verify description is mandatory for saving group transaction', async () => {
    await suite.groupPage.clickOnSaveGroupButton();

    const toastText = await suite.groupPage.getToastMessage(true);
    expect(toastText).toContain('Please enter a group description');
  });
});
