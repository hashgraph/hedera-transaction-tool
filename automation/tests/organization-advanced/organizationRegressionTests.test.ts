import { expect, Page, test } from '@playwright/test';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { calculateTimeout, waitForValidStart } from '../../utils/runtime/timing.js';
import { disableNotificationsForUsers } from '../../utils/db/databaseQueries.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;
let globalCredentials = { email: '', password: '' };

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let firstUser: UserDetails;
let complexKeyAccountId: string;

// Total number of users to be used as complex key
// It should be divisible by 3
let totalUsers = 57; // 57... divisible by 3...? Well this is not a good start...
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe.skip('Organization Regression tests @organization-advanced', () => {
  test.slow();

  test.beforeAll(async () => {
    ({
      app,
      window,
      transactionPage,
      organizationPage,
      loginPage,
      isolationContext,
    } = await setupOrganizationSuiteApp(test.info()));
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: totalUsers,
        organizationNickname,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;
    firstUser = organizationPage.getUser(0);

    await disableNotificationsForUsers(organizationPage.users.map(user => user.email));

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountWithNestedThresholds(totalUsers);

    complexKeyAccountId = organizationPage.getComplexAccountId();
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // The next beforeEach recreates the full regression fixture from scratch.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify user can execute update account tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 5));
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      totalUsers * 5,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId ?? '');
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    await waitForValidStart(validStart ?? '');

    const transactionResponse = await transactionPage.mirrorGetTransactionResponse(txId ?? '');
    const transactionType = transactionResponse?.name;
    const result = transactionResponse?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(result).toBe('SUCCESS');

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute transfer tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 5));
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '10',
      totalUsers * 5,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.logInAndSignTransactionByAllUsers(globalCredentials.password, txId ?? '');
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    await waitForValidStart(validStart ?? '');

    const transactionResponse = await transactionPage.mirrorGetTransactionResponse(txId ?? '');
    const transactionType = transactionResponse?.name;
    const result = transactionResponse?.result;
    expect(transactionType).toBe('CRYPTOTRANSFER');
    expect(result).toBe('SUCCESS');

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Transfer');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });
});
