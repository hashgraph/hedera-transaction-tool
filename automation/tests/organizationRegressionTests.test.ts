import { expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import {
  calculateTimeout,
  closeApp,
  getPrivateKeyEnv,
  setupApp,
  setupEnvironmentForTransactions,
  waitForValidStart,
} from '../utils/automationSupport.js';
import { disableNotificationsForUsers } from '../utils/databaseQueries.js';
import { createSeededOrganizationSession } from '../utils/organizationBaseline.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  createNamespacedLabel,
  resetBackendStateForSuite,
  resetBackendStateForTeardown,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../utils/sharedTestEnvironment.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let globalCredentials = { email: '', password: '' };

let registrationPage: RegistrationPage;
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

test.describe.skip('Organization Regression tests @organization-advanced', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    test.slow();
    isolationContext = await activateSuiteIsolation(test.info());
    organizationNickname = createNamespacedLabel('Test Organization', isolationContext);
    await resetLocalStateForSuite();
    await resetBackendStateForSuite();
    ({ app, window } = await setupApp());
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);
    loginPage = new LoginPage(window);
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

    await setupEnvironmentForTransactions(window, getPrivateKeyEnv());

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountWithNestedThresholds(totalUsers);

    complexKeyAccountId = organizationPage.getComplexAccountId();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
  });

  test.beforeEach(async () => {
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await resetBackendStateForTeardown();
    await cleanupIsolation(isolationContext);
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
