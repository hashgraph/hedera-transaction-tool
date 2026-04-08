import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { ContactListPage } from '../pages/ContactListPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { generateRandomEmail } from '../utils/data/random.js';
import { closeApp, setupApp } from '../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../utils/seeding/organizationSeeding.js';
import { signInOrganizationUser } from './helpers/support/organizationAuthSupport.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  resetBackendStateForSuite,
  resetBackendStateForTeardown,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from './helpers/support/organizationNamingSupport.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let globalCredentials = { email: '', password: '' };
let organizationPage: OrganizationPage;
let contactListPage: ContactListPage;
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let adminUser: UserDetails;
let regularUser: UserDetails;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Contact List tests @organization-basic', () => {
  test.slow();
  test.beforeAll(async () => {
    isolationContext = await activateSuiteIsolation(test.info());
    await resetLocalStateForSuite();
    await resetBackendStateForSuite();
    ({ app, window } = await setupApp());
    organizationPage = new OrganizationPage(window);
    contactListPage = new ContactListPage(window);
    loginPage = new LoginPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 2,
        organizationNickname,
        signInUserIndex: null,
        setupPersonalTransactions: false,
        setupOrganizationTransactions: false,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;

    adminUser = organizationPage.getUser(0);
    regularUser = organizationPage.getUser(1);
    await contactListPage.upgradeUserToAdmin(adminUser.email);
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Some attach-mode reruns fail before the org session is fully established.
      // The next beforeEach recreates a fresh fixture, so this cleanup stays best-effort.
    }
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await resetBackendStateForTeardown();
    await cleanupIsolation(isolationContext);
  });

  test('Verify "Remove" contact list button is visible for an admin role', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(regularUser.email);
    expect(await contactListPage.isRemoveContactButtonVisible()).toBe(true);
  });

  test('Verify "Add new" button is enabled for an admin role', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    expect(await contactListPage.isAddNewContactButtonEnabled()).toBe(true);
  });

  test('Verify "Remove" contact list button is not visible for a regular role', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    expect(await contactListPage.isRemoveContactButtonHidden()).toBe(true);
  });

  test('Verify "Add new" button is invisible for a regular role', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    expect(await contactListPage.isAddNewContactButtonHidden()).toBe(true);
  });

  test('Verify contact email and public keys are displayed', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(regularUser.email);
    const contactEmail = await contactListPage.getContactListEmailText();
    expect(contactEmail).toBe(regularUser.email);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const isPublicKeyCorrect = await contactListPage.comparePublicKeys(regularUser.email);
    expect(isPublicKeyCorrect).toBe(true);
  });

  test('Verify associated accounts are displayed', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    const result = await contactListPage.verifyAssociatedAccounts();
    expect(result).toBe(true);
  });

  test('Verify user can change nickname', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    const newNickname = 'Test-Nickname';
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    await contactListPage.clickOnChangeNicknameButton();
    await contactListPage.fillInContactNickname(newNickname);
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    const nickNameText = await contactListPage.getContactNicknameText(newNickname);
    expect(nickNameText).toBe(newNickname);
  });

  test('Verify admin user can add new user to the organization', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const newUserEmail = generateRandomEmail();
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    const isUserAdded = await contactListPage.verifyUserExistsInOrganization(newUserEmail);
    expect(isUserAdded).toBe(true);
  });

  test('Verify admin user can remove user from the organization', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const newUserEmail = generateRandomEmail();
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    await contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await contactListPage.clickOnRemoveContactButton();
    await contactListPage.clickOnConfirmRemoveContactButton();
    const isUsedDeleted = await contactListPage.isUserDeleted(newUserEmail);
    expect(isUsedDeleted).toBe(true);
  });
});
