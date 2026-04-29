import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { registerOrganizationAdvancedSuiteHooks } from '../helpers/bootstrap/organizationAdvancedSuiteHooks.js';

let window: Page;
let globalCredentials = { email: '', password: '' };

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;

let firstUser: UserDetails;
let complexKeyAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction status/signing lifecycle tests @organization-advanced', () => {
  test.describe.configure({ mode: 'parallel' });
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
    },
    getPages: () => ({ window, loginPage, transactionPage, organizationPage }),
    onFixtureReady: fixture => {
      globalCredentials.email = fixture.localCredentials.email;
      globalCredentials.password = fixture.localCredentials.password;
      firstUser = fixture.firstUser;
      complexKeyAccountId = fixture.complexKeyAccountId;
    },
    logoutFromOrganization: () => organizationPage.logoutFromOrganization(),
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
    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
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

  test('Verify next button is visible when user has multiple txs to sign', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test('Verify user is redirected to the next transaction after clicking the next button', async () => {
    await organizationPage.createAccount(600, 0, false);
    await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();

    let readyToSignCount = 0;
    await expect
      .poll(
        async () => {
          // Re-select the tab each poll to avoid stale table states during async cache updates.
          await organizationPage.clickOnReadyToSignTab();
          readyToSignCount = await organizationPage.countElements(
            organizationPage.transactionNodeTransactionIdIndexSelector,
          );
          return readyToSignCount;
        },
        {
          timeout: organizationPage.getVeryLongTimeout() * 2,
          intervals: [organizationPage.getShortTimeout() * 2],
        },
      )
      .toBeGreaterThan(1);

    // Pick a details row where "Next" is enabled (ordering can vary by validStart sorting).
    await organizationPage.clickOnReadyToSignDetailsButtonByIndex(0);
    let hasEnabledNext = await organizationPage.isNextTransactionButtonEnabled();
    if (!hasEnabledNext && readyToSignCount > 1) {
      await transactionPage.clickOnBackButton();
      await organizationPage.clickOnReadyToSignDetailsButtonByIndex(1);
      hasEnabledNext = await organizationPage.isNextTransactionButtonEnabled();
    }

    expect(hasEnabledNext).toBe(true);
    await organizationPage.clickOnSignTransactionButton();
    const currentTxIdBeforeNext = await organizationPage.getTransactionDetailsId();
    await organizationPage.clickOnNextTransactionButton();
    const currentTxId = await organizationPage.getTransactionDetailsId();
    expect(currentTxId).not.toBe(currentTxIdBeforeNext);
    expect(await organizationPage.isSignTransactionButtonVisible()).toBe(true);
  });

  test('Verify next button is visible when user has multiple txs in history', async () => {
    const { txId } = await organizationPage.createAccount(1, 0, true);
    await organizationPage.closeDraftModal();
    const { txId: secondTxId, validStart } = await organizationPage.createAccount(3, 0, true);
    await organizationPage.closeDraftModal();
    await organizationPage.waitForSuccessfulHistoryTransaction(secondTxId ?? '', validStart);
    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });
});
