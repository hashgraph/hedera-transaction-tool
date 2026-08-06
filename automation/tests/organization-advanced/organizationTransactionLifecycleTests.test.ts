import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { DetailsPage } from '../../pages/DetailsPage.js';
import { signTransactionByAllUsersViaApi } from '../../utils/api/signByAllUsersViaApi.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { registerOrganizationAdvancedSuiteHooks } from '../helpers/bootstrap/organizationAdvancedSuiteHooks.js';

let window: Page;
let globalCredentials = { email: '', password: '' };

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;
let detailsPage: DetailsPage;

let firstUser: UserDetails;
let complexKeyAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction status/signing lifecycle tests @organization-advanced', () => {
  test.describe.configure({ mode: 'parallel' });
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
      detailsPage = new DetailsPage(window);
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
    await organizationPage.waitForStageCompleted(0);
    await organizationPage.waitForStageCompleted(1);

    const isStageThreeCompleted = await organizationPage.isTransactionStageCompleted(2);
    expect(isStageThreeCompleted).toBe(false);
  });

  test('Verify transaction is shown "History" after it is executed', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'newUpdate',
      10,
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

    await organizationPage.waitForStageCompleted(0);
    await organizationPage.waitForStageCompleted(1);
    await organizationPage.waitForStageCompleted(2);
    await organizationPage.waitForStageCompleted(3);
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

  test('Verify signature status panel shows required vs completed signatures (6.3.4)', async () => {
    // Create an account-update transaction without the creator providing their key signature.
    // The complex account key requires all three org users to sign (users[0] at depth 0-0,
    // plus threshold-2-of-2 at depth 1: users[1] at 1-0 and users[2] at 1-1), so the
    // transaction lands in "Ready to Sign" for the current user.
    const { txId } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'sig-status',
      600,
      false,
    );

    // Navigate to transaction details — no signatures submitted yet.
    await organizationPage.openReadyToSignDetailsForTransaction(txId ?? '');

    // The "Signatures Collected" panel must be visible for org transactions.
    expect(await detailsPage.isSignaturesCollectedPanelVisible()).toBe(true);

    // Before anyone signs, the first threshold-group checkmark (depth=1, index=0) must be absent.
    expect(await detailsPage.isKeyNotSignedAtPosition(1, 0)).toBe(true);

    // Sign with one threshold member (users[1]) via API only — users[0] and users[2] have not signed.
    await signTransactionByAllUsersViaApi(
      [organizationPage.users[0], organizationPage.users[1]],
      txId ?? '',
    );

    // Navigate back to transaction details to pick up the updated signature state.
    // The transaction is still in "Ready to Sign" for the current user (users[0] has not signed yet).
    await organizationPage.openReadyToSignDetailsForTransaction(txId ?? '');

    // After users[1] signed, their checkmark at depth=1, index=0 must now be visible.
    expect(await detailsPage.isKeySignedAtPosition(1, 0)).toBe(true);
  });
});
