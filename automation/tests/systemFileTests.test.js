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
 * These tests verify that the user can execute file update transactions for system files.
 * Please note: some delays have been observed between file update and file read. This results in
 * flaky tests.
 */
test.describe('System file tests', () => {
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
    const fileId = '0.0.101';
    const { txId, validStart } = await organizationPage.updateSystemFile(fileId, 5, true);
    await waitForValidStart(validStart);

    //comparing the file from read query with the file from data folder
    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.101');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for node address book(102) ', async () => {
    test.slow();
    const fileId = '0.0.102';

    // Read current file from network
    const networkFileContents = await transactionPage.readFile(fileId);
    const networkJson = JSON.parse(networkFileContents);

    // Read local file
    const fs = require('fs');
    const localJson = JSON.parse(fs.readFileSync('data/102-base.json', 'utf8'));

    // Combine nodeAddress lists
    const combinedNodeAddress = [
      ...networkJson.nodeAddress,
      ...localJson.nodeAddress
    ];

    // Remove duplicates by nodeId (optional, if needed)
    const uniqueNodeAddress = Array.from(
      new Map(combinedNodeAddress.map(n => [n.nodeId, n])).values()
    );

    // Create merged file content
    const mergedJson = { nodeAddress: uniqueNodeAddress };

    fs.writeFileSync('data/102.json', JSON.stringify(mergedJson, null, 2), 'utf8');

    // Update the file on the network
    const { txId, validStart } = await organizationPage.updateSystemFile(
      fileId,
      5,
      true
    );
    await waitForValidStart(validStart);

    // Verify update
    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    expect(transactionDetails?.name).toBe('FILEUPDATE');
    expect(transactionDetails?.entity_id).toBe('0.0.102');
    expect(transactionDetails?.result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for fee schedule(111)', async () => {
    test.slow();
    const fileId = '0.0.111';
    const { txId, validStart } = await organizationPage.updateSystemFile(fileId, 5, true);
    await waitForValidStart(validStart);

    //comparing the file from read query with the file from data folder
    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEAPPEND');
    expect(entityId).toBe('0.0.111');
    expect(result).toBe('FEE_SCHEDULE_FILE_PART_UPLOADED');
  });

  test('Verify user can execute file update transaction for exchange rate(112)', async () => {
    test.slow();
    const fileId = '0.0.112';
    const { txId, validStart } = await organizationPage.updateSystemFile(fileId, 5, true);
    await waitForValidStart(validStart);

    //comparing the file from read query with the file from data folder
    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(result).toBe('SUCCESS');
    expect(entityId).toBe('0.0.112');
  });

  test('Verify user can execute file update transaction for application properties(121) ', async () => {
    test.slow();
    const fileId = '0.0.121';
    const { txId, validStart } = await organizationPage.updateSystemFile(fileId, 5, true);
    await waitForValidStart(validStart);

    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.121');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for api permissions(122) ', async () => {
    test.slow();
    const fileId = '0.0.122';
    const { txId, validStart } = await organizationPage.updateSystemFile('0.0.122', 5, true);
    await waitForValidStart(validStart);

    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.122');
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can execute file update transaction for throttles(123) ', async () => {
    test.slow();
    const fileId = '0.0.123';
    const { txId, validStart } = await organizationPage.updateSystemFile(fileId, 5, true);
    await waitForValidStart(validStart);

    const areIdentical = await organizationPage.areFilesIdentical(fileId);
    expect(areIdentical).toBe(true);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    const entityId = transactionDetails?.entity_id;
    expect(transactionType).toBe('FILEUPDATE');
    expect(entityId).toBe('0.0.123');
    expect(result).toBe('SUCCESS');
  });
});
