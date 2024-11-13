const { test } = require('@playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
  waitForValidStart,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const OrganizationPage = require('../pages/OrganizationPage');
const SettingsPage = require('../pages/SettingsPage');
const { resetDbState, resetPostgresDbState } = require('../utils/databaseUtil');
const { disableNotificationsForTestUsers } = require('../utils/databaseQueries');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, settingsPage;
let firstUser, secondUser, thirdUser;
let complexKeyAccountId;

test.describe('Organization Transaction tests', () => {
  test.beforeAll(async () => {
    test.slow();
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    settingsPage = new SettingsPage(window);
    registrationPage = new RegistrationPage(window);

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Generate test users in PostgreSQL database for organizations
    await organizationPage.createUsers(3);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpUsers(window, globalCredentials.password);

    // Disable notifications for test users
    await disableNotificationsForTestUsers();

    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);
    thirdUser = organizationPage.getUser(2);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountForTransactions();

    complexKeyAccountId = organizationPage.getComplexAccountId();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
  });

  test.beforeEach(async () => {
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify required signers are able to see the transaction in "Ready to Sign" status', async () => {
    const { txId, validStart } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      100,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    const transactionDetails = await organizationPage.getReadyForSignTransactionDetails(txId);

    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails.validStart).toBe(validStart);
    expect(transactionDetails.detailsButton).toBe(true);

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    const transactionDetails2 = await organizationPage.getReadyForSignTransactionDetails(txId);
    expect(transactionDetails2.transactionId).toBe(txId);
    expect(transactionDetails2.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails2.validStart).toBe(validStart);
    expect(transactionDetails2.detailsButton).toBe(true);
  });

  test('Verify the transaction is displayed in the proper status(collecting signatures)', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      100,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId);

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoActive = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoActive).toBe(false);
  });

  test('Verify user is shown as signed by participants', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      100,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId);
    await organizationPage.clickOnSignTransactionButton();

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId);

    const isSignerSignVisible = await organizationPage.isSecondSignerCheckmarkVisible();
    expect(isSignerSignVisible).toBe(true);
  });

  test('Verify transaction is shown "In progress" tab after signing', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      30,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails.validStart).toBe(validStart);
    expect(transactionDetails.detailsButton).toBe(true);
  });

  test('Verify transaction is shown "Ready for Execution" and correct stage is displayed', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      300,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();

    const transactionDetails = await organizationPage.getReadyForExecutionTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails.validStart).toBe(validStart);
    expect(transactionDetails.detailsButton).toBe(true);

    await organizationPage.clickOnReadyForExecutionDetailsButtonByTransactionId(txId);

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoCompleted = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoCompleted).toBe(true);

    const isStageThreeCompleted = await organizationPage.isTransactionStageCompleted(2);
    expect(isStageThreeCompleted).toBe(false);
  });

  test('Verify transaction is shown "History" after it is executed', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'newUpdate',
      5,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await waitForValidStart(validStart);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails.validStart).toBeTruthy();
    expect(transactionDetails.detailsButton).toBe(true);
    expect(transactionDetails.status).toBe('SUCCESS');

    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId);

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoCompleted = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoCompleted).toBe(true);

    const isStageThreeCompleted = await organizationPage.isTransactionStageCompleted(2);
    expect(isStageThreeCompleted).toBe(true);

    const isStageFourCompleted = await organizationPage.isTransactionStageCompleted(3);
    expect(isStageFourCompleted).toBe(true);
  });

  test('Verify transaction is not visible if user is not an observer', async () => {
    const txId = await organizationPage.createAccount();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(txId, 5);
    expect(isTransactionVisible).toBe(false);
  });

  test('Verify observer is listed in the transaction details', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 1);
    const firstObserver = await organizationPage.getObserverEmail(0);
    expect(selectedObservers).toBe(firstObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify transaction is visible for an observer while transaction is "In progress"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(60, 1, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      selectedObservers,
      organizationPage.getUserPasswordByEmail(selectedObservers),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(txId);
    expect(isTransactionVisible).toBe(true);
  });

  test('Verify transaction is visible for an observer while transaction is "Ready for execution"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(60, 1, true);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      selectedObservers,
      organizationPage.getUserPasswordByEmail(selectedObservers),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const isTransactionVisible =
      await organizationPage.isTransactionIdVisibleReadyForExecution(txId);
    expect(isTransactionVisible).toBe(true);
  });

  test('Verify observer is saved in the db for the correct transaction id', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(60, 1);
    const userIdInDb = await organizationPage.getUserIdByEmail(selectedObservers);
    const txIdForObserver = await organizationPage.getAllTransactionIdsForUserObserver(userIdInDb);
    expect(txIdForObserver).toContain(txId);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify user can add multiple observers', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 2, false);
    const firstObserver = await organizationPage.getObserverEmail(0);
    const secondObserver = await organizationPage.getObserverEmail(1);
    expect(selectedObservers[0]).toBe(firstObserver);
    expect(selectedObservers[1]).toBe(secondObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify next button is visible when user has multiple txs to sign', async () => {
    await organizationPage.createAccount(60, 0, false);
    const { txId } = await organizationPage.createAccount(60, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId);
    await organizationPage.clickOnSignTransactionButton();
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test('Verify user is redirected to the next transaction after clicking the next button', async () => {
    await organizationPage.createAccount(60, 0, false);
    const { txId } = await organizationPage.createAccount(60, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId);
    await organizationPage.clickOnSignTransactionButton();
    await organizationPage.clickOnNextTransactionButton();
    const currentTxId = await organizationPage.getTransactionDetailsId();
    expect(currentTxId).not.toBe(txId);
    expect(await organizationPage.isSignTransactionButtonVisible()).toBe(true);
  });

  test('Verify next button is visible when user has multiple txs in history', async () => {
    test.slow();
    const { txId } = await organizationPage.createAccount(5, 0, true);
    const { validStart } = await organizationPage.createAccount(10, 0, true);
    await waitForValidStart(validStart);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();
    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId);
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test('Verify user can execute transfer transaction with complex account', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '10',
      15,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await waitForValidStart(validStart);

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Transfer Transaction');
    expect(transactionDetails.validStart).toBeTruthy();
    expect(transactionDetails.detailsButton).toBe(true);
    expect(transactionDetails.status).toBe('SUCCESS');
  });

  test('Verify user can execute approve allowance with complex account', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.approveAllowance(
      complexKeyAccountId,
      '10',
      15,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await waitForValidStart(validStart);

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Allowance Approve Transaction');
    expect(transactionDetails.validStart).toBeTruthy();
    expect(transactionDetails.detailsButton).toBe(true);
    expect(transactionDetails.status).toBe('SUCCESS');
  });
});
