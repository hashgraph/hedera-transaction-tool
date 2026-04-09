import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { waitForValidStart } from '../../utils/runtime/timing.js';
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

let firstUser: UserDetails;
let secondUser: UserDetails;
let thirdUser: UserDetails;
let complexKeyAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction status/signing tests @organization-advanced', () => {
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
    firstUser = fixture.firstUser;
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

  test('Verify transaction is shown "Ready for Execution" and correct stage is displayed', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      600,
      true,
    );
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await organizationPage.logInAndSignTransactionByAllUsers(
      globalCredentials.password,
      txId ?? '',
    );
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();

    const transactionDetails = await organizationPage.getReadyForExecutionTransactionDetails(
      txId ?? '',
    );
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);

    await organizationPage.clickOnReadyForExecutionDetailsButtonByTransactionId(txId ?? '');

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoCompleted = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoCompleted).toBe(true);

    const isStageThreeCompleted = await organizationPage.isTransactionStageCompleted(2);
    expect(isStageThreeCompleted).toBe(false);
  });

  test('Verify transaction is shown "History" after it is executed', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'newUpdate',
      5,
      true,
    );
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await organizationPage.logInAndSignTransactionByAllUsers(
      globalCredentials.password,
      txId ?? '',
    );
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
    await waitForValidStart(validStart ?? '');
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');

    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoCompleted = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoCompleted).toBe(true);

    const isStageThreeCompleted = await organizationPage.isTransactionStageCompleted(2);
    expect(isStageThreeCompleted).toBe(true);

    const isStageFourCompleted = await organizationPage.isTransactionStageCompleted(3);
    expect(isStageFourCompleted).toBe(true);
  });

  test.skip('Verify next button is visible when user has multiple txs to sign', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test.skip('Verify user is redirected to the next transaction after clicking the next button', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    await organizationPage.clickOnNextTransactionButton();
    const currentTxId = await organizationPage.getTransactionDetailsId();
    expect(currentTxId).not.toBe(txId);
    expect(await organizationPage.isSignTransactionButtonVisible()).toBe(true);
  });

  test.skip('Verify next button is visible when user has multiple txs in history', async () => {
    const { txId } = await organizationPage.createAccount(1, 0, true);
    await organizationPage.closeDraftModal();
    const { validStart } = await organizationPage.createAccount(3, 0, true);
    await organizationPage.closeDraftModal();
    await waitForValidStart(validStart ?? '');
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();
    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });
});
