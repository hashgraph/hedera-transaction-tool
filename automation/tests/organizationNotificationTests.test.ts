import { expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { flushRateLimiter } from '../utils/databaseUtil.js';
import {
  closeApp,
  getPrivateKeyEnv,
  setupApp,
  setupEnvironmentForTransactions,
} from '../utils/automationSupport.js';
import {
  disableNotificationsForUsers,
  getLatestInAppNotificationStatusByEmail,
  getNotifiedTransactionIdByEmail,
} from '../utils/databaseQueries.js';
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
let secondUser: UserDetails;

test.describe.skip('Organization Notification tests @organization-basic', () => {
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
        userCount: 3,
        organizationNickname,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;
    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);

    await disableNotificationsForUsers([firstUser.email, secondUser.email], true);

    await setupEnvironmentForTransactions(window, getPrivateKeyEnv());

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountForTransactions();
  });

  test.beforeEach(async () => {
    // Flush rate limiter before each test to prevent "too many requests" errors
    await flushRateLimiter();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await resetBackendStateForTeardown();
    await cleanupIsolation(isolationContext);
  });

  test('Verify notification is visible in the organization dropdown', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    expect(await organizationPage.isNotificationIndicatorElementVisible()).toBe(true);
  });

  test('Verify notification is saved in the db and marked correctly', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    let status = await getLatestInAppNotificationStatusByEmail(secondUser.email);
    expect(status?.isRead).toBe(false);
    expect(status?.isInAppNotified).toBe(true);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    // Wait for notifications to be fetched and linked to transaction rows
    await expect.poll(
      () => getNotifiedTransactionIdByEmail(secondUser.email),
      { timeout: 5000, intervals: [500] },
    ).toBeTruthy();
    // Click Details to VIEW the transaction - this marks the notification as read
    await organizationPage.clickOnReadyToSignDetailsButtonByIndex(0);

    // Wait for backend to process the "mark as read" request and update DB
    await expect.poll(
      async () => (await getLatestInAppNotificationStatusByEmail(secondUser.email))?.isRead,
      { timeout: 10000, intervals: [500] },
    ).toBe(true);
  });

  test('Verify tab notification is cleared after the transaction is seen', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    // Wait for notifications to be fetched and linked to transaction rows
    await expect.poll(
      () => getNotifiedTransactionIdByEmail(secondUser.email),
      { timeout: 5000, intervals: [500] },
    ).toBeTruthy();
    // Click Details to VIEW the transaction - this marks the notification as read and clears the indicator
    await organizationPage.clickOnReadyToSignDetailsButtonByIndex(0);
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(await organizationPage.isNotificationNumberHidden()).toBe(true);
  });

  test('Verify notification element is shown next to the transaction', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    const notifiedTransactionId = await getNotifiedTransactionIdByEmail(secondUser.email);
    expect(notifiedTransactionId).not.toBeNull();

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    // Wait for notifications to be fetched and linked to transaction rows
    await expect.poll(
      () => getNotifiedTransactionIdByEmail(secondUser.email),
      { timeout: 5000, intervals: [500] },
    ).toBeTruthy();

    const hasNotification = await organizationPage.hasNotificationForTransaction(notifiedTransactionId!);
    expect(hasNotification).toBe(true);
  });
});
