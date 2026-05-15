import { expect, Page, test } from '@playwright/test';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { calculateTimeout } from '../../utils/runtime/timing.js';
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
let totalUsers = 9;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Regression tests @organization-advanced', () => {
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

  async function assertComplexKeyTxFlow(
    txId: string | null | undefined,
    validStart: string | null | undefined,
    expected: { mirrorType: string; historyType: string },
  ) {
    await organizationPage.signTransactionByAllUsersViaApi(txId ?? '');

    const transactionResponse = await transactionPage.mirrorGetTransactionResponse(txId ?? '');
    expect(transactionResponse?.name).toBe(expected.mirrorType);
    expect(transactionResponse?.result).toBe('SUCCESS');

    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe(expected.historyType);
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  }

  test('Verify user can execute update account tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 10));
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      totalUsers * 5,
      true,
    );
    await assertComplexKeyTxFlow(txId, validStart, {
      mirrorType: 'CRYPTOUPDATEACCOUNT',
      historyType: 'Account Update',
    });
  });

  test('Verify user can execute transfer tx for complex key account similar to council account', async () => {
    test.setTimeout(calculateTimeout(totalUsers, 10));
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '10',
      totalUsers * 5,
      true,
    );
    await assertComplexKeyTxFlow(txId, validStart, {
      mirrorType: 'CRYPTOTRANSFER',
      historyType: 'Transfer',
    });
  });
});
