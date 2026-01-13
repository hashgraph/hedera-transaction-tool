import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { ContactListPage } from '../pages/ContactListPage.js';
import { resetDbState, resetPostgresDbState } from '../utils/databaseUtil.js';
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
let organizationPage: OrganizationPage;
let contactListPage: ContactListPage;

let adminUser: UserDetails;
let regularUser: UserDetails;

test.describe('Organization Contact List tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);
    contactListPage = new ContactListPage(window);

    // Check if we need to reset app state (if user exists from previous run)
    const isSettingsButtonVisible = await loginPage.isSettingsButtonVisible();
    if (isSettingsButtonVisible) {
      console.log('Existing user detected, resetting app state...');
      await resetAppState(window, app);
    }

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
    await contactListPage.upgradeUserToAdmin(adminUser.email);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpInitialUsers(window, globalCredentials.password);
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
    await contactListPage.clickOnAccountInContactListByEmail(regularUser.email);
    expect(await contactListPage.isRemoveContactButtonVisible()).toBe(true);
  });

  test('Verify "Add new" button is enabled for an admin role', async () => {
    await organizationPage.signInOrganization(
      adminUser.email,
      adminUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    expect(await contactListPage.isAddNewContactButtonEnabled()).toBe(true);
  });

  test('Verify "Remove" contact list button is not visible for a regular role', async () => {
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    expect(await contactListPage.isRemoveContactButtonHidden()).toBe(true);
  });

  test('Verify "Add new" button is invisible for a regular role', async () => {
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    expect(await contactListPage.isAddNewContactButtonHidden()).toBe(true);
  });

  test('Verify contact email and public keys are displayed', async () => {
    test.slow();
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(regularUser.email);

    const contactEmail = await contactListPage.getContactListEmailText();
    expect(contactEmail).toBe(regularUser.email);

    // verifying that public keys displayed for the contact are matching the public keys in the database
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
    const isPublicKeyCorrect = await contactListPage.comparePublicKeys(regularUser.email);
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
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);

    const result = await contactListPage.verifyAssociatedAccounts();
    expect(result).toBe(true);
  });

  test('Verify user can change nickname', async () => {
    const newNickname = 'Test-Nickname';
    await organizationPage.signInOrganization(
      regularUser.email,
      regularUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    await contactListPage.clickOnChangeNicknameButton();
    await contactListPage.fillInContactNickname(newNickname);
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    const nickNameText = await contactListPage.getContactNicknameText(newNickname);
    expect(nickNameText).toBe(newNickname);
  });

  test('Verify admin user can add new user to the organization', async () => {
    const newUserEmail = generateRandomEmail();
    await organizationPage.signInOrganization(
      adminUser.email,
      adminUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    const isUserAdded = await contactListPage.verifyUserExistsInOrganization(newUserEmail);
    expect(isUserAdded).toBe(true);
  });

  test('Verify admin user can remove user from the organization', async () => {
    const newUserEmail = generateRandomEmail();
    await organizationPage.signInOrganization(
      adminUser.email,
      adminUser.password,
      globalCredentials.password,
    );

    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    await contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await contactListPage.clickOnRemoveContactButton();
    await contactListPage.clickOnConfirmRemoveContactButton();

    const isUsedDeleted = await contactListPage.isUserDeleted(newUserEmail);
    expect(isUsedDeleted).toBe(true);
  });
});
