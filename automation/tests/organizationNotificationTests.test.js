const { test } = require('@playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const OrganizationPage = require('../pages/OrganizationPage');
const SettingsPage = require('../pages/SettingsPage');
const { resetDbState, resetPostgresDbState } = require('../utils/databaseUtil');
const {
  disableNotificationsForTestUsers,
  getLatestNotificationStatusByEmail,
} = require('../utils/databaseQueries');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, settingsPage;
let firstUser, secondUser;
let complexKeyAccountId;

test.describe('Organization Notification tests', () => {
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
    await organizationPage.setUpUsers(window, globalCredentials.password, false);
    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);

    // Disable email notifications for test users
    await disableNotificationsForTestUsers(true);

    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window, process.env.PRIVATE_KEY);

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountForTransactions();

    complexKeyAccountId = organizationPage.getComplexAccountId();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify notification is visible in the organization dropdown', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    expect(await organizationPage.getNotificationElementFromDropdown()).toBe(true);
  });

  test('Verify notification is saved in the db and marked correctly', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    let { isRead, isInAppNotified } = await getLatestNotificationStatusByEmail(secondUser.email);
    expect(isRead).toBe(false);
    expect(isInAppNotified).toBe(true);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await new Promise(resolve => setTimeout(resolve, 300));
    ({ isRead } = await getLatestNotificationStatusByEmail(secondUser.email));
    expect(isRead).toBe(true);
  });

  test('Verify tab notification is cleared after the transaction is seen', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(await organizationPage.isNotificationNumberVisible()).toBe(false);
  });

  test('Verify notification element is shown next to the transaction', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();

    expect(await organizationPage.getNotificationElementFromFirstTransaction()).toBe(true);
  });
});
