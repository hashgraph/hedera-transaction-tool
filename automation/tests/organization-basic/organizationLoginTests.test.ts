import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let organizationPage: OrganizationPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';
let encryptionPassword = '';
let organizationUser: UserDetails;

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Login tests @organization-basic', () => {
  test.slow();

  test.beforeAll(async () => {
    ({ app, window, loginPage, organizationPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 1,
        organizationNickname,
        signInUserIndex: null,
        setupPersonalTransactions: false,
        setupOrganizationTransactions: false,
      },
    );
    encryptionPassword = seededSession.localUser.password;
    organizationUser = organizationPage.getUser(0);
    await loginPage.waitForToastToDisappear();
    await organizationPage.waitForElementToBeVisible(
      organizationPage.emailForOrganizationInputSelector,
    );
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Most tests stay on the organization login page; cleanup is best-effort.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify login fails with wrong password', async () => {
    await loginPage.waitForToastToDisappear();
    await organizationPage.fillInLoginDetailsAndClickSignIn(
      organizationUser.email,
      `${organizationUser.password}123`,
    );

    const passwordErrorMessage = (
      await organizationPage.getOrganizationLoginPasswordErrorMessage()
    )?.trim();
    expect(passwordErrorMessage).toBe('Invalid password');
  });

  test('Verify success toast is shown after login', async () => {
    await loginPage.waitForToastToDisappear();
    await organizationPage.signInOrganization(
      organizationUser.email,
      organizationUser.password,
      encryptionPassword,
    );

    await organizationPage.waitForToastMessage('Successfully signed in');

    expect(await organizationPage.isContactListButtonVisible()).toBe(true);
  });
});
