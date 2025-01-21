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

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, organizationPage, settingsPage;
let firstUser;

test.describe('Organization Settings tests', () => {
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
    await organizationPage.createUsers(1);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpUsers(window, globalCredentials.password);

    // Log in with the organization user
    firstUser = organizationPage.getUser(0);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify user can switch between personal and organization mode', async () => {
    await organizationPage.selectPersonalMode();
    const isContactListVisible = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisible).toBe(false);

    await organizationPage.selectOrganizationMode();
    const isContactListVisibleAfterSwitch = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisibleAfterSwitch).toBe(true);
  });

  test('Verify user can edit organization nickname', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();

    await organizationPage.editOrganizationNickname('New Organization');
    const orgName = await organizationPage.getOrganizationNicknameText();
    expect(orgName).toBe('New Organization');

    await organizationPage.editOrganizationNickname('Test Organization');
  });

  test('Verify error message when user adds non-existing organization', async () => {
    await loginPage.waitForToastToDisappear();
    await organizationPage.setupWrongOrganization();
    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Organization does not exist. Please check the server URL');
    await organizationPage.clickOnCancelAddingOrganizationButton();
  });

  test('Verify user is prompted for mnemonic phrase and can recover account when resetting organization', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization();
    await organizationPage.fillInLoginDetailsAndClickSignIn(firstUser.email, firstUser.password);
    await organizationPage.recoverAccount(0);
    await organizationPage.recoverPrivateKey(window);
    const isContactListVisible = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisible).toBe(true);
  });

  test('Verify additional keys are saved when user restores his account', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization();
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await organizationPage.recoverAccount(0);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    const missingKey = await organizationPage.isFirstMissingKeyVisible();
    expect(missingKey).toBe(true);
    await organizationPage.recoverPrivateKey(window);
  });

  test('Verify user can restore missing keys when doing account recovery', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization();
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await organizationPage.recoverAccount(0);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await organizationPage.recoverPrivateKey(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    const missingKey = await organizationPage.isFirstMissingKeyVisible();
    expect(missingKey).toBe(false);
  });

  test('Verify organization user can change password', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnProfileTab();

    await settingsPage.fillInCurrentPassword(firstUser.password);
    const newPassword = generateRandomPassword();
    await settingsPage.fillInNewPassword(newPassword);
    await settingsPage.clickOnChangePasswordButton();
    await settingsPage.clickOnConfirmChangePassword();
    if (await organizationPage.isEncryptPasswordInputVisible()) {
      await organizationPage.fillOrganizationEncryptionPasswordAndContinue(
        globalCredentials.password,
      );
    }
    await settingsPage.clickOnCloseButton();
    organizationPage.changeUserPassword(firstUser.email, newPassword);
    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // verify that the settings button is visible(indicating he's logged in successfully in the app)
    const isButtonVisible = await loginPage.isSettingsButtonVisible();
    expect(isButtonVisible).toBe(true);
  });

  test('Verify user can restore account with new mnemonic phrase', async () => {
    test.slow();
    const publicKeyBeforeReset = await organizationPage.getFirstPublicKeyByEmail(firstUser.email);
    const userId = await organizationPage.getUserIdByEmail(firstUser.email);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization();
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    organizationPage.generateAndSetRecoveryWords();
    await organizationPage.recoverAccount(0);

    //verify old mnemonic is still present in the db
    const isKeyDeleted = await organizationPage.isKeyDeleted(publicKeyBeforeReset);
    expect(isKeyDeleted).toBe(false);

    const isNewKeyAddedInDb = await organizationPage.findNewKey(userId);
    expect(isNewKeyAddedInDb).toBe(true);
  });

  test('Verify that tabs on Transaction page are visible', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    expect(await organizationPage.returnAllTabsVisible()).toBe(true);
  });

  test('Verify user can delete an organization', async () => {
    await organizationPage.selectPersonalMode();
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await loginPage.waitForToastToDisappear();
    await organizationPage.clickOnDeleteFirstOrganization();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Connection deleted successfully');

    const orgName = await organizationPage.getOrganizationNicknameText();
    const isDeletedFromDb = await organizationPage.verifyOrganizationExists(orgName);
    expect(isDeletedFromDb).toBe(false);
  });
});
