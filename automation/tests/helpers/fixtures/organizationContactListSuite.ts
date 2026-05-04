import { Page, test } from '@playwright/test';
import { ContactListPage } from '../../../pages/ContactListPage.js';
import { LoginPage } from '../../../pages/LoginPage.js';
import { OrganizationPage, type UserDetails } from '../../../pages/OrganizationPage.js';
import { RegistrationPage } from '../../../pages/RegistrationPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { isUserAdmin } from '../../../utils/db/databaseQueries.js';
import { createSeededOrganizationSession } from '../../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../bootstrap/organizationSuiteBootstrap.js';
import { createSequentialOrganizationNicknameResolver } from '../support/organizationNamingSupport.js';
import type { ActivatedTestIsolationContext } from '../../../utils/setup/sharedTestEnvironment.js';

export function setupOrganizationContactListSuite() {
  let app: TransactionToolApp;
  let window: Page;
  const credentials = { email: '', password: '' };
  let organizationPage: OrganizationPage;
  let contactListPage: ContactListPage;
  let loginPage: LoginPage;
  let registrationPage: RegistrationPage;
  let transactionPage: TransactionPage;
  let isolationContext: ActivatedTestIsolationContext | null = null;
  let adminUser: UserDetails;
  let regularUser: UserDetails;
  let organizationNickname = 'Test Organization';

  const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

  test.slow();

  test.beforeAll(async () => {
    ({ app, window, loginPage, organizationPage, transactionPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));
    contactListPage = new ContactListPage(window);
    registrationPage = new RegistrationPage(window);
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
    credentials.email = seededSession.localUser.email;
    credentials.password = seededSession.localUser.password;

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
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  return {
    get window() {
      return window;
    },
    get credentials() {
      return credentials;
    },
    get organizationPage() {
      return organizationPage;
    },
    get contactListPage() {
      return contactListPage;
    },
    get loginPage() {
      return loginPage;
    },
    get registrationPage() {
      return registrationPage;
    },
    get transactionPage() {
      return transactionPage;
    },
    get adminUser() {
      return adminUser;
    },
    get regularUser() {
      return regularUser;
    },
    isUserAdmin,
  };
}
