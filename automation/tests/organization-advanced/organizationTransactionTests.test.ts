import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupOrganizationAdvancedFixture } from '../helpers/fixtures/organizationAdvancedFixture.js';
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

let secondUser: UserDetails;
let thirdUser: UserDetails;
let complexKeyAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction status/signing tests @organization-advanced', () => {
  test.describe.configure({ mode: 'parallel' });
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
    window.on('console', msg => {
      const text = msg.text();
      if (
        text.includes('[TXD-DBG]') ||
        text.includes('[SIG-AUDIT-DBG]') ||
        text.includes('[ORG-USER-DBG]')
      ) {
        console.log('[BROWSER]', text);
      }
    });
  });

  test.beforeEach(async ({}, testInfo) => {
    await flushRateLimiter();
    await setDialogMockState(window, { savePath: null, openPaths: [] });

    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const fixture = await setupOrganizationAdvancedFixture(
      window,
      loginPage,
      organizationPage,
      organizationNickname,
    );
    globalCredentials.email = fixture.localCredentials.email;
    globalCredentials.password = fixture.localCredentials.password;
    secondUser = fixture.secondUser;
    thirdUser = fixture.thirdUser;
    complexKeyAccountId = fixture.complexKeyAccountId;
    await transactionPage.clickOnTransactionsMenuButton();

    await organizationPage.waitForElementToDisappear('.v-toast__text');
    await organizationPage.closeDraftModal();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Several tests delete or fully consume the current org session.
      // The next beforeEach recreates the fixture from scratch.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify required signers are able to see the transaction in "Ready to Sign" status', async () => {
    const { txId, validStart } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    const transactionDetails = await organizationPage.getReadyForSignTransactionDetails(txId ?? '');

    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    const transactionDetails2 = await organizationPage.getReadyForSignTransactionDetails(
      txId ?? '',
    );
    expect(transactionDetails2?.transactionId).toBe(txId);
    expect(transactionDetails2?.transactionType).toBe('Account Update');
    expect(transactionDetails2?.validStart).toBe(validStartTime);
    expect(transactionDetails2?.detailsButton).toBe(true);
  });

  test('Verify the transaction is displayed in the proper status(collecting signatures)', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoActive = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoActive).toBe(false);
  });

  test('Verify user is shown as signed by participants', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');
    await organizationPage.waitForElementToDisappear('.v-toast__text');

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');

    const isSignerSignVisible = await organizationPage.isSecondSignerCheckmarkVisible();
    expect(isSignerSignVisible).toBe(true);
  });

  test.skip(
    'Ready for Review tab shows transactions pending approval',
    async () => {
      // Approvers-related workflows are behind a feature flag in this repo/environment.
      // When enabled, this test should create a transaction requiring approval and assert it is visible in the
      // "Ready for Review" tab.
    },
  );

  test('Verify organization History filters work for Status and Transaction Type', async () => {
    const creator = organizationPage.users[0];

    // Create a Transfer transaction, then cancel it -> should show as CANCELED in History.
    const { txId: canceledTxId } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '1',
      30,
      true,
    );
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    await organizationPage.clickOnInProgressDetailsButtonByTransactionId(canceledTxId ?? '');
    await organizationPage.clickOnCancelTransactionButton();
    await organizationPage.clickOnConfirmCancelButton();

    // Create an Account Update that will execute successfully -> should show as SUCCESS in History.
    await transactionPage.clickOnTransactionsMenuButton();
    const { txId: executedTxId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'history-filter-executed',
      8,
      true,
    );
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await organizationPage.logInAndSignTransactionByAllUsers(
      globalCredentials.password,
      executedTxId ?? '',
    );
    await organizationPage.signInOrganization(
      creator.email,
      creator.password,
      globalCredentials.password,
    );
    await organizationPage.waitForSuccessfulHistoryTransaction(executedTxId ?? '', validStart);

    const normalizedCanceledTxId = (canceledTxId ?? '').replace(/\s+/g, '');
    const normalizedExecutedTxId = (executedTxId ?? '').replace(/\s+/g, '');
    const historyIdCells = window.locator('[data-testid^="td-transaction-node-transaction-id-"]');

    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedCanceledTxId }).count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedExecutedTxId }).count())
      .toBeGreaterThan(0);

    // 4.5.8: Filter by status.
    await window.getByRole('button', { name: /Status/i }).click();
    await window.locator('.dropdown-menu.show').getByText('Canceled', { exact: true }).click();
    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedCanceledTxId }).count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedExecutedTxId }).count())
      .toBe(0);

    const statusClear = window
      .locator('.rounded.border')
      .filter({ hasText: 'Status' })
      .locator('.bi-x-lg');
    await statusClear.click();

    // 4.5.9: Filter by transaction type.
    await window.getByRole('button', { name: /Transaction Type/i }).click();
    await window.locator('.dropdown-menu.show').getByText('Transfer', { exact: true }).click();
    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedCanceledTxId }).count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => historyIdCells.filter({ hasText: normalizedExecutedTxId }).count())
      .toBe(0);
  });

  test('Verify transaction is shown "In progress" tab after signing', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      30,
      true,
    );
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);
  });

  test('Verify transaction is shown "History" tab after canceling and cannot be signed again', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      30,
      true,
    );
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);

    await organizationPage.clickOnInProgressDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnCancelTransactionButton();
    await organizationPage.clickOnConfirmCancelButton();
    await expect
      .poll(() => organizationPage.isSignTransactionButtonVisible(), { timeout: 10000 })
      .toBe(false);

    await organizationPage.logoutFromOrganization();
    for (const user of organizationPage.users) {
      await organizationPage.fillInLoginDetailsAndClickSignIn(user.email, user.password);
      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.clickOnHistoryTab();
      const historyDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(historyDetails?.transactionId).toBe(txId);
      expect(historyDetails?.transactionType).toBe('Account Update');
      expect(historyDetails?.validStart).toBe('N/A');
      expect(historyDetails?.status).toBe('CANCELED');
      expect(historyDetails?.detailsButton).toBe(true);
      await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
      expect(await organizationPage.isSignTransactionButtonVisible()).toBe(false);
      await organizationPage.logoutFromOrganization();
    }

    const user0 = organizationPage.users[0];
    await organizationPage.fillInLoginDetailsAndClickSignIn(user0.email, user0.password);
  });
});
