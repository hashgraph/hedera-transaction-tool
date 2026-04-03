import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { GroupPage } from '../pages/GroupPage.js';
import type { TransactionToolApp } from '../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../utils/runtime/environment.js';
import { createSeededLocalUserSession } from '../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from './helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../utils/setup/sharedTestEnvironment.js';
import { prepareGroupTransactionPage } from './helpers/flows/groupTransactionNavigationFlow.js';
import {
  addAndEditAccountCreateGroupTransaction,
  DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES,
} from './helpers/flows/groupTransactionFlow.js';
import { GroupTransactionAssertions } from './helpers/assertions/groupTransactionAssertions.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;
let groupAssertions: GroupTransactionAssertions;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Group transaction tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    groupPage = new GroupPage(window);
    groupAssertions = new GroupTransactionAssertions(transactionPage);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await prepareGroupTransactionPage({ transactionPage, groupPage });
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test('Verify group transaction elements', async () => {
    const isAllElementsPresent = await groupPage.verifyGroupElements();
    expect(isAllElementsPresent).toBe(true);
  });

  test('Verify that empty group and empty transaction is not saved', async () => {
    await groupPage.clickOnAddTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    // If we click immediatly on back button, then Add To Group button appears
    // If we wait a bit, then no save dialog => we wait a bit :(
    await new Promise(resolve => setTimeout(resolve, 1000));
    await transactionPage.clickOnBackButton();
    await groupPage.clickOnBackButton();

    //verify no transaction group is saved
    await transactionPage.navigateToDrafts();
    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify delete group action does not save the group', async () => {
    await groupPage.fillDescription('test');

    //attempt to leave the transaction group page
    await transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to delete the group
    await groupPage.clickOnDeleteGroupButton();

    //verify transaction group is not saved
    await transactionPage.navigateToDrafts();
    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify continue editing action saves the group', async () => {
    await groupPage.fillDescription('test');

    //attempt to leave the transaction group page
    await transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to continue editing
    await groupPage.clickOnContinueEditingButton();

    //verify user is still at tx group page
    expect(await groupPage.isDeleteModalHidden()).toBe(true);
    expect(await groupPage.verifyGroupElements()).toBe(true);
  });

  test('Verify user can delete transaction from the group', async () => {
    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickTransactionDeleteButton(0);

    //verifying that the transaction is deleted
    expect(await groupPage.isEmptyTransactionTextVisible()).toBe(true);
    expect(await groupPage.isTransactionHidden(0)).toBe(true);
  });

  test('Verify description is mandatory for saving group transaction', async () => {
    await groupPage.clickOnSaveGroupButton();

    const toastText = await groupPage.getToastMessage(true);
    expect(toastText).toContain('Please enter a group description');
  });

  test('Verify user can add transaction to the group', async () => {
    await groupPage.addSingleTransactionToGroup();

    expect(await groupPage.getTransactionType(0)).toBe('Account Create Transaction');
  });

  test('Verify user can edit transaction in the group', async () => {
    const values = await addAndEditAccountCreateGroupTransaction(groupPage, transactionPage);

    //verifying that there is no duplicate transaction
    expect(await groupPage.isTransactionHidden(1)).toBe(true);

    //verifying that the transaction data is updated
    await groupPage.clickTransactionEditButton(0);
    await groupAssertions.assertAccountCreateTransactionValues(values);
  });

  test('Verify user can duplicate transaction in the group', async () => {
    const values = await addAndEditAccountCreateGroupTransaction(
      groupPage,
      transactionPage,
      DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES,
    );

    await groupPage.clickTransactionDuplicateButton(0);

    //verifying that the transaction is duplicated
    expect(await groupPage.getTransactionType(1)).toBe('Account Create Transaction');

    await groupPage.clickTransactionEditButton(1);
    await groupAssertions.assertAccountCreateTransactionValues(values);
  });

  test('Verify user can delete many transactions at once(delete all)', async () => {
    await groupPage.addSingleTransactionToGroup(10);

    await groupPage.clickOnDeleteAllButton();
    await groupPage.clickOnConfirmDeleteAllButton();

    //verifying that the transaction is deleted
    expect(await groupPage.isEmptyTransactionTextVisible()).toBe(true);
    expect(await groupPage.isTransactionHidden(0)).toBe(true);
  });

  test('Verify user can save a transaction group', async () => {
    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickOnSaveGroupButton();
    await transactionPage.clickOnDraftsMenuButton();
    await transactionPage.clickOnFirstDraftContinueButton();

    expect(await groupPage.getTransactionType(0)).toBe('Account Create Transaction');

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify user can delete a transaction group', async () => {
    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickOnSaveGroupButton();
    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();

    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify user can execute group transaction', async () => {
    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
  });

  test('Verify user can execute duplicated group transactions', async () => {
    await groupPage.addSingleTransactionToGroup();
    // Duplicate the transaction twice
    await groupPage.clickTransactionDuplicateButton(0);
    await groupPage.clickTransactionDuplicateButton(0);

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    const secondTxId = await groupPage.getTransactionTimestamp(1) ?? '';
    const thirdTxId = await groupPage.getTransactionTimestamp(2) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
    await groupAssertions.assertMirrorTransactionResult(secondTxId, 'CRYPTOCREATEACCOUNT');
    await groupAssertions.assertMirrorTransactionResult(thirdTxId, 'CRYPTOCREATEACCOUNT');
  });

  test('Verify user can execute different transactions in a group', async () => {
    await groupPage.addSingleTransactionToGroup();
    await groupPage.addSingleTransactionToGroup(1, true);

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    const secondTxId = await groupPage.getTransactionTimestamp(1) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
    await groupAssertions.assertMirrorTransactionResult(secondTxId, 'FILECREATE');
  });

  test('Verify transaction and linked group items and transaction group exists in db', async () => {
    await groupPage.addSingleTransactionToGroup();
    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await transactionPage.mirrorGetTransactionResponse(txId);
    expect(await groupPage.doTransactionGroupsExist(txId)).toBe(true);
  });
});
