import { expect, test } from '@playwright/test';
import { GroupTransactionAssertions } from '../helpers/assertions/groupTransactionAssertions.js';
import {
  addAndEditAccountCreateGroupTransaction,
  DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES,
} from '../helpers/flows/groupTransactionFlow.js';
import { setupGroupTransactionSuite } from '../helpers/fixtures/groupTransactionSuite.js';

test.describe('Group transaction item tests @local-transactions', () => {
  const suite = setupGroupTransactionSuite();

  test('Verify user can delete transaction from the group', async () => {
    await suite.groupPage.addSingleTransactionToGroup();

    await suite.groupPage.clickTransactionDeleteButton(0);

    //verifying that the transaction is deleted
    expect(await suite.groupPage.isEmptyTransactionTextVisible()).toBe(true);
    expect(await suite.groupPage.isTransactionHidden(0)).toBe(true);
  });

  test('Verify user can add transaction to the group', async () => {
    await suite.groupPage.addSingleTransactionToGroup();

    expect(await suite.groupPage.getTransactionType(0)).toBe('Account Create Transaction');
  });

  test('Verify user can edit transaction in the group', async () => {
    const values = await addAndEditAccountCreateGroupTransaction(
      suite.groupPage,
      suite.transactionPage,
    );
    const groupAssertions = new GroupTransactionAssertions(suite.transactionPage);

    //verifying that there is no duplicate transaction
    expect(await suite.groupPage.isTransactionHidden(1)).toBe(true);

    //verifying that the transaction data is updated
    await suite.groupPage.clickTransactionEditButton(0);
    await groupAssertions.assertAccountCreateTransactionValues(values);
  });

  test('Verify user can duplicate transaction in the group', async () => {
    const values = await addAndEditAccountCreateGroupTransaction(
      suite.groupPage,
      suite.transactionPage,
      DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES,
    );
    const groupAssertions = new GroupTransactionAssertions(suite.transactionPage);

    await suite.groupPage.clickTransactionDuplicateButton(0);

    //verifying that the transaction is duplicated
    expect(await suite.groupPage.getTransactionType(1)).toBe('Account Create Transaction');

    await suite.groupPage.clickTransactionEditButton(1);
    await groupAssertions.assertAccountCreateTransactionValues(values);
  });

  test('Verify user can delete many transactions at once(delete all)', async () => {
    await suite.groupPage.addSingleTransactionToGroup(10);

    await suite.groupPage.clickOnDeleteAllButton();
    await suite.groupPage.clickOnConfirmDeleteAllButton();

    //verifying that the transaction is deleted
    expect(await suite.groupPage.isEmptyTransactionTextVisible()).toBe(true);
    expect(await suite.groupPage.isTransactionHidden(0)).toBe(true);
  });

  test('Verify cancelling "Delete All" keeps all transactions in the group', async () => {
    await suite.groupPage.addSingleTransactionToGroup(2);

    await suite.groupPage.clickOnDeleteAllButton();
    await suite.groupPage.clickOnCancelDeleteAllButton();

    expect(await suite.groupPage.isEmptyTransactionTextVisible()).toBe(false);
    expect(await suite.groupPage.getTransactionType(0)).toBe('Account Create Transaction');
    expect(await suite.groupPage.getTransactionType(1)).toBe('Account Create Transaction');
  });

  test('Verify user can save a transaction group', async () => {
    await suite.groupPage.addSingleTransactionToGroup();

    await suite.groupPage.clickOnSaveGroupButton();
    await suite.transactionPage.clickOnDraftsMenuButton();
    await suite.transactionPage.clickOnFirstDraftContinueButton();

    expect(await suite.groupPage.getTransactionType(0)).toBe('Account Create Transaction');

    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();
  });

  test('Verify user can delete a transaction group', async () => {
    await suite.groupPage.addSingleTransactionToGroup();

    await suite.groupPage.clickOnSaveGroupButton();
    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();

    const isContinueButtonHidden = await suite.transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });
});
