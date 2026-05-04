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
const COMPLEX_FILE_EXECUTION_DELAY_SECONDS = 30;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction execution-type tests @organization-advanced', () => {
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
    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Transfer');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute approve allowance with complex account', async () => {
    const { txId, validStart } = await organizationPage.approveAllowance(complexKeyAccountId, '10');
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
    expect(transactionDetails?.transactionType).toBe('Account Allowance Approve');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute file create with complex account', async () => {
    const { txId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      COMPLEX_FILE_EXECUTION_DELAY_SECONDS,
      globalCredentials,
      firstUser,
    );
    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Create');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute file update with complex account', async () => {
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      COMPLEX_FILE_EXECUTION_DELAY_SECONDS,
      globalCredentials,
      firstUser,
    );
    const { txId, validStart } = await organizationPage.fileUpdate(
      fileId ?? '',
      complexKeyAccountId,
      'newContent',
    );
    await organizationPage.closeDraftModal();
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Update');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute file append with complex account', async () => {
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      COMPLEX_FILE_EXECUTION_DELAY_SECONDS,
      globalCredentials,
      firstUser,
    );
    const { txId, validStart } = await organizationPage.fileAppend(
      fileId ?? '',
      complexKeyAccountId,
      'appendContent',
    );
    await organizationPage.closeDraftModal();
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
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
    const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
      txId ?? '',
      validStart,
    );
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Delete');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });
});
