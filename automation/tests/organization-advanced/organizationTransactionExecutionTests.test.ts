import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { waitForValidStart } from '../../utils/runtime/timing.js';
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

test.describe('Organization Transaction execution-type tests @organization-advanced', () => {
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

  test('Verify user can execute transfer transaction with complex account', async () => {
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '15',
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

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Transfer');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute approve allowance with complex account', async () => {
    const { txId, validStart } = await organizationPage.approveAllowance(
      complexKeyAccountId,
      '10',
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

    await organizationPage.clickOnHistoryTab();
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Allowance Approve');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test.skip('Verify user can execute file create with complex account', async () => {
    const { txId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      globalCredentials,
      firstUser,
      600,
    );
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Create');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test.skip('Verify user can execute file update with complex account', async () => {
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      globalCredentials,
      firstUser,
      600,
    );
    const { txId, validStart } = await organizationPage.fileUpdate(
      fileId ?? '',
      complexKeyAccountId,
      'newContent',
    );
    await organizationPage.closeDraftModal();
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    await waitForValidStart(validStart ?? '');

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Update');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test.skip('Verify user can execute file append with complex account', async () => {
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      globalCredentials,
      firstUser,
      600,
    );
    const { txId, validStart } = await organizationPage.fileAppend(
      fileId ?? '',
      complexKeyAccountId,
      'appendContent',
    );
    await organizationPage.closeDraftModal();
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    await waitForValidStart(validStart ?? '');

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Append');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute account delete with complex account', async () => {
    const { txId, validStart } = await organizationPage.deleteAccount(complexKeyAccountId);
    await organizationPage.closeDraftModal();
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    await waitForValidStart(validStart ?? '');

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Delete');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });
});
