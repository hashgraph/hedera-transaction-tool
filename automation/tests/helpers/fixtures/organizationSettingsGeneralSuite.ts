import { Page, test } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage.js';
import { OrganizationPage } from '../../../pages/OrganizationPage.js';
import { RegistrationPage } from '../../../pages/RegistrationPage.js';
import { SettingsPage } from '../../../pages/SettingsPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../support/organizationNamingSupport.js';

export function setupOrganizationSettingsGeneralSuite() {
  let app: TransactionToolApp;
  let window: Page;
  let registrationPage: RegistrationPage;
  let loginPage: LoginPage;
  let transactionPage: TransactionPage;
  let organizationPage: OrganizationPage;
  let settingsPage: SettingsPage;
  let isolationContext: ActivatedTestIsolationContext | null = null;
  let organizationNickname = 'Test Organization';
  let updatedOrganizationNickname = 'New Organization';
  let invalidOrganizationNickname = 'Bad Organization';

  const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

  test.slow();

  test.beforeAll(async () => {
    ({ app, window, loginPage, transactionPage, organizationPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));
    settingsPage = new SettingsPage(window);
    registrationPage = new RegistrationPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    updatedOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Updated Organization',
    );
    invalidOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Invalid Organization',
    );

    await createSeededOrganizationSession(window, loginPage, organizationPage, {
      userCount: 1,
      organizationNickname,
    });
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Tests can end in personal mode or after deleting the organization.
      // The next beforeEach recreates the full fixture.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  return {
    get window() {
      return window;
    },
    get registrationPage() {
      return registrationPage;
    },
    get loginPage() {
      return loginPage;
    },
    get transactionPage() {
      return transactionPage;
    },
    get organizationPage() {
      return organizationPage;
    },
    get settingsPage() {
      return settingsPage;
    },
    get organizationNickname() {
      return organizationNickname;
    },
    get updatedOrganizationNickname() {
      return updatedOrganizationNickname;
    },
    get invalidOrganizationNickname() {
      return invalidOrganizationNickname;
    },
  };
}
