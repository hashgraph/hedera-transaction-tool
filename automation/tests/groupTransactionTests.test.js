const { test } = require('@playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword, setupEnvironmentForTransactions,
} = require('../utils/util');
const { getPrivateKey, generateEd25519KeyPair } = require('../utils/keyUtil');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const SettingsPage = require('../pages/SettingsPage');
const TransactionPage = require('../pages/TransactionPage');
const GroupPage = require('../pages/GroupPage');
const { resetDbState } = require('../utils/databaseUtil');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, settingsPage, transactionPage, groupPage;

test.describe('Group transaction tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    settingsPage = new SettingsPage(window);
    transactionPage = new TransactionPage(window);
    groupPage = new GroupPage(window);

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
    await transactionPage.clickOnTransactionsMenuButton();

    //this is needed because tests fail in CI environment
    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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
    await groupPage.fillDescription("test");

    //attempt to leave the transaction group page
    await transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to delete the group
    await groupPage.clickOnDeleteGroupButton();

    //verify transaction group is not saved
    await transactionPage.navigateToDrafts();
    const isContinueButtonVisible = await transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(false);
  });

  test('Verify continue editing action saves the group', async () => {
    await groupPage.fillDescription("test");

    //attempt to leave the transaction group page
    await transactionPage.clickOnTransactionsMenuButton();

    //modal is displayed and we choose to continue editing
    await groupPage.clickOnContinueEditingButton();

    //verify user is still at tx group page
    expect(await groupPage.isDeleteModalVisible()).toBe(false);
    expect(await groupPage.verifyGroupElements()).toBe(true);
  });

  test('Verify description is mandatory for saving group transaction', async () => {
    await groupPage.clickOnSaveGroupButton();

    const toastText = await groupPage.getToastMessage();
    expect(toastText).toContain('Please enter a group description');
  });

  test('Verify user can add transaction to the group', async () => {
    await groupPage.addSingleTransactionToGroup();

    expect(await groupPage.getTransactionType(0)).toBe("Account Create Transaction");
  });

  test('Verify user can edit transaction in the group', async () => {
    const initialFunds = "50";
    const maxAutoTokenAssociation = "10";
    const transactionMemo = "test memo";
    const accountMemo = "test account memo";

    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickTransactionEditButton(0);

    await transactionPage.fillInInitialFunds(initialFunds);
    await transactionPage.fillInMaxAccountAssociations(maxAutoTokenAssociation);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemo);
    await transactionPage.fillInMemo(accountMemo);
    await groupPage.clickAddToGroupButton();


    //verifying that there is no duplicate transaction
    expect(await groupPage.isTransactionVisible(1)).toBe(false);

    //verifying that the transaction data is updated
    await groupPage.clickTransactionEditButton(0);
    expect(await transactionPage.getTransactionTypeHeaderText()).toBe("Account Create Transaction");
    expect(await transactionPage.getInitialFundsValue()).toBe(initialFunds);
    expect(await transactionPage.getFilledMaxAccountAssociations()).toBe(maxAutoTokenAssociation);
    expect(await transactionPage.getTransactionMemoText()).toBe(transactionMemo);
    expect(await transactionPage.getMemoText()).toBe(accountMemo);
  });

  test('Verify user can duplicate transaction in the group', async () => {
    const initialFunds = "50";
    const maxAutoTokenAssociation = "10";
    const transactionMemo = "test memo";
    const accountMemo = "test account memo";

    await groupPage.addSingleTransactionToGroup();

    await groupPage.clickTransactionEditButton(0);

    await transactionPage.fillInInitialFunds(initialFunds);
    await transactionPage.fillInMaxAccountAssociations(maxAutoTokenAssociation);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemo);
    await transactionPage.fillInMemo(accountMemo);
    await groupPage.clickAddToGroupButton();

    await groupPage.clickTransactionDuplicateButton(0);

    //verifying that the transaction is duplicated
    expect(await groupPage.getTransactionType(1)).toBe("Account Create Transaction");

    await groupPage.clickTransactionEditButton(1);
    expect(await transactionPage.getTransactionTypeHeaderText()).toBe("Account Create Transaction");
    expect(await transactionPage.getInitialFundsValue()).toBe(initialFunds);
    expect(await transactionPage.getFilledMaxAccountAssociations()).toBe(maxAutoTokenAssociation);
    expect(await transactionPage.getTransactionMemoText()).toBe(transactionMemo);
    expect(await transactionPage.getMemoText()).toBe(accountMemo);
  });
});
