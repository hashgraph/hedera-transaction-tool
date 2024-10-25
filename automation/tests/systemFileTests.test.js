const { test, expect } = require('@playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
  waitForValidStart,
  cleanupBinFiles,
} = require('../utils/util');
const { resetDbState, resetPostgresDbState } = require('../utils/databaseUtil');
const { disableNotificationsForTestUsers } = require('../utils/databaseQueries');
const RegistrationPage = require('../pages/RegistrationPage');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const OrganizationPage = require('../pages/OrganizationPage');
const SettingsPage = require('../pages/SettingsPage');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, settingsPage;
let firstUser;

/**
 * These tests verify that the user can execute file update transactions for system files
 * Executing some of these tests breaks the local node and requires a restart
 */

test.describe.skip('System file tests', () => {
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
    await organizationPage.createUsers(1);

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

    await setupEnvironmentForTransactions(window, process.env.OPERATOR_KEY);

    await transactionPage.clickOnTransactionsMenuButton();
  });

  test.beforeEach(async () => {
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
    await cleanupBinFiles('./data');
  });

  test('Verify user can execute file update transaction for node address book(101) ', async () => {
    test.slow();

    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.101', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.101');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for node address book(102) ', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.102', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.102');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for fee schedule(111)', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.111', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEAPPEND');
    expect(entityId).toBe('0.0.111');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for exchange rate(112)', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.112', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(result).toBe('SUCCESS');
    expect(entityId).toBe('0.0.112');
  });

  test('Verify user can execute file update transaction for application properties(121) ', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.121', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.121');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for api permissions(122) ', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.122', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.122');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for throttles(123) ', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.123', 5, true);
    await waitForValidStart(validStart);
    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const result = transactionDetails.transactions[0]?.result;
    const entityId = transactionDetails.transactions[0]?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.123');
    expect(result).toBe('SUCCESS');
  });
});
