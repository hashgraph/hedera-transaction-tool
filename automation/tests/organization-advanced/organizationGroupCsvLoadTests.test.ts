import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { GroupPage } from '../../pages/GroupPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupOrganizationAdvancedFixture } from '../helpers/fixtures/organizationAdvancedFixture.js';
import { executeOrganizationGroupFromCsvFile } from '../helpers/flows/organizationGroupFlow.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { prepareGroupTransactionPage } from '../helpers/flows/groupTransactionNavigationFlow.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;
let globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let organizationPage: OrganizationPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let firstUser: UserDetails;
let complexKeyAccountId: string;
let newAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Group CSV load tests @organization-advanced', () => {
  test.slow();
  test.beforeAll(async () => {
    ({
      app,
      window,
      loginPage,
      transactionPage,
      organizationPage,
      isolationContext,
    } = await setupOrganizationSuiteApp(test.info()));
    groupPage = new GroupPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    await flushRateLimiter();

    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const fixture = await setupOrganizationAdvancedFixture(
      window,
      loginPage,
      organizationPage,
      organizationNickname,
      true,
    );
    globalCredentials.email = fixture.localCredentials.email;
    globalCredentials.password = fixture.localCredentials.password;
    firstUser = fixture.firstUser;
    complexKeyAccountId = fixture.complexKeyAccountId;
    newAccountId = fixture.secondaryComplexKeyAccountId ?? '';
    groupPage.organizationPage = organizationPage;

    await groupPage.waitForElementToDisappear(groupPage.toastMessageSelector);
    await prepareGroupTransactionPage({
      transactionPage,
      groupPage,
      closePostNavigationModals: true,
    });
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Group tests can end in intermediary modal states.
      // The next beforeEach recreates the org fixture from scratch.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test(`Verify user can import csv with 100 transactions`, async () => {
    const isAllTransactionsSuccessful = await executeOrganizationGroupFromCsvFile({
      groupPage,
      loginPage,
      organizationPage,
      transactionPage,
      firstUser,
      encryptionPassword: globalCredentials.password,
      senderAccountId: complexKeyAccountId,
      receiverAccountId: newAccountId,
      numberOfTransactions: 100,
      signAll: true,
    });
    expect(isAllTransactionsSuccessful).toBe(true);
  });
});
