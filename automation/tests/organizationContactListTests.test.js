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
const { getAssociatedAccounts } = require('../utils/mirrorNodeAPI');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, settingsPage;
let adminUser, regularUser;

test.describe('Organization Contact List tests', () => {
  test.beforeAll(async () => {
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
    await organizationPage.createUsers(2);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    adminUser = organizationPage.getUser(0);
    regularUser = organizationPage.getUser(1);
    await organizationPage.upgradeUserToAdmin(adminUser.email);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpUsers(window, globalCredentials.password);
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify "Remove" contact list button is visible for an admin role', async () => {
    await organizationPage.signInOrganization(
      adminUser.email,
      adminUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await organizationPage.clickOnAccountInContactListByEmail(regularUser.email);
    expect(await organizationPage.isRemoveContactButtonVisible()).toBe(true);
  });

  test('Verify "Add new" button is enabled for an admin role', async () => {
    await organizationPage.signInOrganization(
      adminUser.email,
      adminUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    expect(await organizationPage.isAddNewContactButtonEnabled()).toBe(true);
  });

  test('Verify "Remove" contact list button is not visible for a regular role', async () => {
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );
    await organizationPage.clickOnContactListButton();
    await organizationPage.clickOnAccountInContactListByEmail(adminUser.email);
    expect(await organizationPage.isRemoveContactButtonVisible()).toBe(false);
  });

  test('Verify "Add new" button is enabled for a regular role', async () => {
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    expect(await organizationPage.isAddNewContactButtonEnabled()).toBe(false);
  });

  test('Verify contact email and public keys are displayed', async () => {
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await organizationPage.clickOnAccountInContactListByEmail(regularUser.email);

    const contactEmail = await organizationPage.getContactListEmailText();
    expect(contactEmail).toBe(regularUser.email);

    // verifying that public keys displayed for the contact are matching the public keys in the database
    const isPublicKeyCorrect = await organizationPage.comparePublicKeys(regularUser.email);
    expect(isPublicKeyCorrect).toBe(true);
  });

  test('Verify associated accounts are displayed', async () => {
    test.slow();
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await organizationPage.clickOnAccountInContactListByEmail(adminUser.email);

    const result = await organizationPage.verifyAssociatedAccounts();
    expect(result).toBe(true);
  });
});
