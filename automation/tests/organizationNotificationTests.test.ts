import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { resetDbState, resetPostgresDbState, flushRateLimiter } from '../utils/databaseUtil.js';
import {
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  getPrivateKeyEnv,
  setupApp,
  setupEnvironmentForTransactions,
} from '../utils/util.js';
import {
  disableNotificationsForTestUsers,
  getLatestInAppNotificationStatusByEmail,
  getNotifiedTransactionIdByEmail,
} from '../utils/databaseQueries.js';

let app: ElectronApplication;
let window: Page;
let globalCredentials = { email: '', password: '' };

let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;

let firstUser: UserDetails;
let secondUser: UserDetails;

test.describe('Organization Notification tests', () => {
  test.beforeAll(async () => {
    test.slow();
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Generate test users in PostgreSQL database for organizations
    await organizationPage.createUsers(3);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpInitialUsers(window, globalCredentials.password, false);
    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);

    // Disable email notifications for test users
    await disableNotificationsForTestUsers(true);

    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

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
    await resetDbState();
    await resetPostgresDbState();
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Click Details to VIEW the transaction - this marks the notification as read
    await organizationPage.clickOnReadyToSignDetailsButtonByIndex(0);

    // Wait for backend to process the "mark as read" request and update DB
    await new Promise(resolve => setTimeout(resolve, 1500));
    status = await getLatestInAppNotificationStatusByEmail(secondUser.email);
    expect(status?.isRead).toBe(true);
  });

  test('Verify tab notification is cleared after the transaction is seen', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    // Wait for notifications to be fetched and linked to transaction rows
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Click Details to VIEW the transaction - this marks the notification as read and clears the indicator
    await organizationPage.clickOnReadyToSignDetailsButtonByIndex(0);
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(await organizationPage.isNotificationNumberHidden()).toBe(true);
  });

  test('Verify notification element is shown next to the transaction', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    // Get the specific transaction ID that has the unread notification
    const notifiedTransactionId = await getNotifiedTransactionIdByEmail(secondUser.email);
    expect(notifiedTransactionId).not.toBeNull();

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    // Wait for notifications to be fetched and linked to transaction rows
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check the specific transaction row for the notification indicator
    const hasNotification = await organizationPage.hasNotificationForTransaction(notifiedTransactionId!);
    expect(hasNotification).toBe(true);
  });
});
