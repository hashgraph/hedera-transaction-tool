const { test } = require('@playwright/test');
const { expect } = require('playwright/test');
const RegistrationPage = require('../pages/RegistrationPage.js');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const OrganizationPage = require('../pages/OrganizationPage');
const GroupPage = require('../pages/GroupPage');
const { resetDbState, resetPostgresDbState } = require('../utils/databaseUtil');
const { disableNotificationsForTestUsers } = require('../utils/databaseQueries');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, groupPage;
let firstUser, secondUser, thirdUser;
let complexKeyAccountId, newAccountId;

test.describe('Organization Group Tx tests', () => {
  test.beforeAll(async () => {
    test.slow();
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);
    groupPage = new GroupPage(window);

    // window.on('console', (message) => {
    //   console.log('Console Log:', message.text());
    // });

    organizationPage.complexFileId = [];

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
    await organizationPage.addComplexKeyAccountForTransactions();
    newAccountId = organizationPage.complexAccountId[organizationPage.complexAccountId.length - 1];
    groupPage.organizationPage = organizationPage;
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
  });

  test.beforeEach(async () => {
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

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

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify user can execute group transaction in organization', async () => {
    test.slow();
    await groupPage.addOrgAllowanceTransactionToGroup(2, complexKeyAccountId, '10');

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0);
    const secondTxId = await groupPage.getTransactionTimestamp(1);
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupPage.clickOnSignAllButton();
    await loginPage.waitForToastToDisappear();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await groupPage.logInAndSignGroupTransactionsByAllUsers(globalCredentials.password);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    expect(transactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(result).toBe('SUCCESS');

    const secondTransactionDetails = await transactionPage.mirrorGetTransactionResponse(secondTxId);
    const secondTransactionType = secondTransactionDetails.transactions[0]?.name;
    const secondResult = secondTransactionDetails.transactions[0]?.result;
    expect(secondTransactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(secondResult).toBe('SUCCESS');
  });

  [5, 100].forEach((numberOfTransactions) => {
    test(`Verify user can import csv transactions with ${numberOfTransactions} transactions`, async () => {
      test.slow();
      await groupPage.fillDescription('test');
      await groupPage.generateAndImportCsvFile(complexKeyAccountId, newAccountId,  numberOfTransactions);
      await groupPage.clickOnSignAndExecuteButton();
      await groupPage.clickOnConfirmGroupTransactionButton();
      const timestamps = await groupPage.getAllTransactionTimestamps(numberOfTransactions);
      await groupPage.clickOnSignAllButton();
      await loginPage.waitForToastToDisappear();
      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.logoutFromOrganization();
      await groupPage.logInAndSignGroupTransactionsByAllUsers(globalCredentials.password, numberOfTransactions > 10);
      await organizationPage.signInOrganization(
        firstUser.email,
        firstUser.password,
        globalCredentials.password,
      );
      const isAllTransactionsSuccessful =
        await groupPage.verifyAllTransactionsAreSuccessful(timestamps);
      expect(isAllTransactionsSuccessful).toBe(true);
    });
  });
});
