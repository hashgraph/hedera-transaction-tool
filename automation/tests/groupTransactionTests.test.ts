import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { GroupPage } from '../pages/GroupPage.js';
import { resetDbState } from '../utils/databaseUtil.js';
import {
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupApp,
  setupEnvironmentForTransactions,
  resetAppState,
} from '../utils/util.js';
import { LoginPage } from '../pages/LoginPage.js';

let app: ElectronApplication;
let window: Page;
let globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;

test.describe('Group transaction tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    groupPage = new GroupPage(window);

    // Check if we need to reset app state (if user exists from previous run)
    const isSettingsButtonVisible = await loginPage.isSettingsButtonVisible();
    if (isSettingsButtonVisible) {
      console.log('Existing user detected, resetting app state...');
      await resetAppState(window, app);
    }

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);
  });

  test.beforeEach(async () => {
    // Wait for any ongoing operations to complete
    await window.waitForLoadState('networkidle');

    // Ensure menu button is visible before clicking
    await transactionPage.waitForElementToBeVisible(
      transactionPage.transactionsMenuButtonSelector,
      5000,
    );
    await transactionPage.clickOnTransactionsMenuButton();

    // Additional wait for CI environment stability
    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for page to stabilize after navigation
    await window.waitForLoadState('networkidle');

    await groupPage.closeDraftTransactionModal();
    await groupPage.closeGroupDraftModal();
    await groupPage.deleteGroupModal();

    await groupPage.navigateToGroupTransaction();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test('Verify group transaction elements', async () => {
    const isAllElementsPresent = await groupPage.verifyGroupElements();
    expect(isAllElementsPresent).toBe(true);
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
    const initialFunds = '50';
    const maxAutoTokenAssociation = '10';
    const transactionMemo = 'test memo';
    const accountMemo = 'test account memo';

    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickTransactionEditButton(0);

    await transactionPage.fillInInitialFunds(initialFunds);
    await transactionPage.fillInMaxAccountAssociations(maxAutoTokenAssociation);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemo);
    await transactionPage.fillInMemo(accountMemo);
    await groupPage.clickAddToGroupButton();

    //verifying that there is no duplicate transaction
    expect(await groupPage.isTransactionHidden(1)).toBe(true);

    //verifying that the transaction data is updated
    await groupPage.clickTransactionEditButton(0);
    expect(await transactionPage.getTransactionTypeHeaderText()).toBe('Account Create Transaction');
    expect(await transactionPage.getInitialFundsValue()).toBe(initialFunds);
    expect(await transactionPage.getFilledMaxAccountAssociations()).toBe(maxAutoTokenAssociation);
    expect(await transactionPage.getTransactionMemoText()).toBe(transactionMemo);
    expect(await transactionPage.getMemoText()).toBe(accountMemo);
  });

  test('Verify user can duplicate transaction in the group', async () => {
    const initialFunds = '50';
    const maxAutoTokenAssociation = '10';
    const transactionMemo = 'test memo';
    const accountMemo = 'test account memo';

    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickTransactionEditButton(0);

    await transactionPage.fillInInitialFunds(initialFunds);
    await transactionPage.fillInMaxAccountAssociations(maxAutoTokenAssociation);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemo);
    await transactionPage.fillInMemo(accountMemo);
    await groupPage.clickAddToGroupButton();

    await groupPage.clickTransactionDuplicateButton(0);

    //verifying that the transaction is duplicated
    expect(await groupPage.getTransactionType(1)).toBe('Account Create Transaction');

    await groupPage.clickTransactionEditButton(1);
    expect(await transactionPage.getTransactionTypeHeaderText()).toBe('Account Create Transaction');
    expect(await transactionPage.getInitialFundsValue()).toBe(initialFunds);
    expect(await transactionPage.getFilledMaxAccountAssociations()).toBe(maxAutoTokenAssociation);
    expect(await transactionPage.getTransactionMemoText()).toBe(transactionMemo);
    expect(await transactionPage.getMemoText()).toBe(accountMemo);
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

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const newAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;

    expect(transactionType).toBe('CRYPTOCREATEACCOUNT');
    expect(newAccount).toBeTruthy();
    expect(result).toBe('SUCCESS');
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

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const newAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOCREATEACCOUNT');
    expect(newAccount).toBeTruthy();
    expect(result).toBe('SUCCESS');

    const secondTransactionDetails = await transactionPage.mirrorGetTransactionResponse(secondTxId);
    const secondTransactionType = secondTransactionDetails?.name;
    const secondNewAccount = secondTransactionDetails?.entity_id;
    const secondResult = secondTransactionDetails?.result;
    expect(secondTransactionType).toBe('CRYPTOCREATEACCOUNT');
    expect(secondNewAccount).toBeTruthy();
    expect(secondResult).toBe('SUCCESS');

    const thirdTransactionDetails = await transactionPage.mirrorGetTransactionResponse(thirdTxId);
    const thirdTransactionType = thirdTransactionDetails?.name;
    const thirdNewAccount = thirdTransactionDetails?.entity_id;
    const thirdResult = thirdTransactionDetails?.result;
    expect(thirdTransactionType).toBe('CRYPTOCREATEACCOUNT');
    expect(thirdNewAccount).toBeTruthy();
    expect(thirdResult).toBe('SUCCESS');
  });

  test('Verify user can execute different transactions in a group', async () => {
    await groupPage.addSingleTransactionToGroup();
    await groupPage.addSingleTransactionToGroup(1, true);

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    const secondTxId = await groupPage.getTransactionTimestamp(1) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const newAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOCREATEACCOUNT');
    expect(newAccount).toBeTruthy();
    expect(result).toBe('SUCCESS');

    const secondTransactionDetails = await transactionPage.mirrorGetTransactionResponse(secondTxId);
    const secondTransactionType = secondTransactionDetails?.name;
    const secondNewAccount = secondTransactionDetails?.entity_id;
    const secondResult = secondTransactionDetails?.result;
    expect(secondTransactionType).toBe('FILECREATE');
    expect(secondNewAccount).toBeTruthy();
    expect(secondResult).toBe('SUCCESS');
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
