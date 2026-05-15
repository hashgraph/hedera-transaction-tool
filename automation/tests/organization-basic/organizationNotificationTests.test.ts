import { expect, Page, test } from '@playwright/test';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import {
  disableNotificationsForUsers,
  getInAppNotificationStatusByEmailAndTransactionId,
} from '../../utils/db/databaseQueries.js';
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
let secondUser: UserDetails;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

async function gotoReadyToSignTab() {
  await transactionPage.clickOnTransactionsMenuButton();
  await organizationPage.clickOnReadyToSignTab();
}

// NOTE: Do not enable test.describe.configure({ mode: 'parallel' }) here.
// Tests in this suite share a single seeded organization, complex-key account, and
// secondUser notification state set up in beforeAll. They also depend on sequential
// read/unread transitions of that notification — tests 1 and 4 leave it unread for
// later reuse, tests 2/3/5 mark it read so the next test creates a fresh one.
// Running these in parallel would race on shared DB rows and the complex account.
test.describe('Organization Notification tests @organization-basic', () => {
  test.slow();

  test.beforeAll(async () => {
    ({ app, window, transactionPage, organizationPage, loginPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));

    await flushRateLimiter();

    organizationNickname = resolveOrganizationNickname('organization-notification-suite');
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

    // Complex-key account is reused across every test in this suite.
    // ensureNotificationStateForUser re-funds it via updateAccount each time it
    // needs to generate a fresh notification.
    await organizationPage.addComplexKeyAccountForTransactions(globalCredentials.password);
  });

  test.beforeEach(async () => {
    // Flush rate limiter before each test to prevent "too many requests" errors.
    // The org, users, and complex-key account are seeded once in beforeAll and
    // shared across tests; ensureNotificationStateForUser handles re-login and
    // either reuses an existing unread notification or creates a new one.
    await flushRateLimiter();
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify notification is visible in the organization dropdown', async () => {
    await organizationPage.ensureNotificationStateForUser(firstUser, secondUser, globalCredentials);

    expect(await organizationPage.isNotificationIndicatorElementVisible()).toBe(true);
  });

  test('Verify notification is saved in the db and marked correctly', async () => {
    const notifiedTransactionId = await organizationPage.ensureNotificationStateForUser(
      firstUser,
      secondUser,
      globalCredentials,
    );
    expect(notifiedTransactionId).toBeTruthy();

    await expect
      .poll(
        async () => {
          const status = await getInAppNotificationStatusByEmailAndTransactionId(
            secondUser.email,
            notifiedTransactionId!,
          );
          return status?.isRead === false && status?.isInAppNotified === true;
        },
        {
          timeout: organizationPage.getVeryLongTimeout(),
          intervals: [organizationPage.getShortTimeout()],
        },
      )
      .toBe(true);

    // Click Details to VIEW the transaction - this marks the notification as read
    await organizationPage.openReadyToSignDetailsForTransaction(notifiedTransactionId!);

    // Wait for backend to process the "mark as read" request and update DB
    await expect
      .poll(
        async () =>
          (
            await getInAppNotificationStatusByEmailAndTransactionId(
              secondUser.email,
              notifiedTransactionId!,
            )
          )?.isRead,
        {
          timeout: organizationPage.getVeryLongTimeout(),
          intervals: [organizationPage.getShortTimeout()],
        },
      )
      .toBe(true);
  });

  test('Verify tab notification is cleared after the transaction is seen', async () => {
    const notifiedTransactionId = await organizationPage.ensureNotificationStateForUser(
      firstUser,
      secondUser,
      globalCredentials,
    );
    expect(notifiedTransactionId).toBeTruthy();

    // Click Details to VIEW the transaction - this marks the notification as read and clears the indicator
    await organizationPage.openReadyToSignDetailsForTransaction(notifiedTransactionId!);

    await expect
      .poll(() => organizationPage.isNotificationNumberHidden(), {
        timeout: organizationPage.getLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(true);
  });

  test('Verify notification element is shown next to the transaction', async () => {
    const notifiedTransactionId = await organizationPage.ensureNotificationStateForUser(
      firstUser,
      secondUser,
      globalCredentials,
    );
    expect(notifiedTransactionId).toBeTruthy();

    await gotoReadyToSignTab();
    await expect
      .poll(() => organizationPage.hasNotificationForTransaction(notifiedTransactionId!), {
        timeout: organizationPage.getVeryLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(true);
  });

  test('Verify Ready to Sign tab badge count tracks notifications as transactions are viewed', async () => {
    const firstTransactionId = await organizationPage.ensureNotificationStateForUser(
      firstUser,
      secondUser,
      globalCredentials,
    );
    expect(firstTransactionId).toBeTruthy();

    await gotoReadyToSignTab();

    await expect
      .poll(() => organizationPage.getReadyToSignTabBadgeCount(), {
        timeout: organizationPage.getVeryLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(1);

    const secondTransactionId = await organizationPage.createAdditionalNotificationForUser(
      firstUser,
      secondUser,
      globalCredentials,
      firstTransactionId!,
    );
    expect(secondTransactionId).toBeTruthy();
    expect(secondTransactionId).not.toBe(firstTransactionId);

    await gotoReadyToSignTab();

    await expect
      .poll(() => organizationPage.getReadyToSignTabBadgeCount(), {
        timeout: organizationPage.getVeryLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(2);

    await organizationPage.openReadyToSignDetailsForTransaction(firstTransactionId!);
    await gotoReadyToSignTab();

    await expect
      .poll(() => organizationPage.getReadyToSignTabBadgeCount(), {
        timeout: organizationPage.getVeryLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(1);

    await organizationPage.openReadyToSignDetailsForTransaction(secondTransactionId!);
    await gotoReadyToSignTab();

    await expect
      .poll(() => organizationPage.getReadyToSignTabBadgeCount(), {
        timeout: organizationPage.getVeryLongTimeout(),
        intervals: [organizationPage.getShortTimeout()],
      })
      .toBe(0);
  });
});
