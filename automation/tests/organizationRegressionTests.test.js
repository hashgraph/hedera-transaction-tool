const { test } = require('@playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
  calculateTimeout,
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
let firstUser;
let complexKeyAccountId;

// Total number of users to be used as complex key
// It should be divisible by 3
let totalUsers = 57;

test.describe.skip('Organization Regression tests', () => {
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
    await organizationPage.createUsers(totalUsers);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpUsers(window, globalCredentials.password, false);
    firstUser = organizationPage.getUser(0);

    // Disable notifications for test users
    await disableNotificationsForTestUsers();

    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window, process.env.PRIVATE_KEY);

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountWithNestedThresholds(totalUsers);

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

  test('Verify user can execute update account tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 5));
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      totalUsers * 5,
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

    const transactionResponse = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionResponse.transactions[0]?.name;
    const result = transactionResponse.transactions[0]?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(result).toBe('SUCCESS');

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Account Update Transaction');
    expect(transactionDetails.validStart).toBeTruthy();
    expect(transactionDetails.detailsButton).toBe(true);
    expect(transactionDetails.status).toBe('SUCCESS');
  });

  test('Verify user can execute transfer tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 5));
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '10',
      totalUsers * 5,
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

    const transactionResponse = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionResponse.transactions[0]?.name;
    const result = transactionResponse.transactions[0]?.result;
    expect(transactionType).toBe('CRYPTOTRANSFER');
    expect(result).toBe('SUCCESS');

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId);
    expect(transactionDetails.transactionId).toBe(txId);
    expect(transactionDetails.transactionType).toBe('Transfer Transaction');
    expect(transactionDetails.validStart).toBeTruthy();
    expect(transactionDetails.detailsButton).toBe(true);
    expect(transactionDetails.status).toBe('SUCCESS');
  });
});
