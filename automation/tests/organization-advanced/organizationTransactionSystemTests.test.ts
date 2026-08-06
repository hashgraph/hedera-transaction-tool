import { expect, Page, test } from '@playwright/test';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { registerOrganizationAdvancedSuiteHooks } from '../helpers/bootstrap/organizationAdvancedSuiteHooks.js';

let window: Page;

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

// System Delete requires an expiration between 30 and 92 days from now.
const SYSTEM_DELETE_EXPIRATION_DAYS = 60;
// Valid-start offset gives the org server time to collect signatures before execution.
const SYSTEM_TRANSACTION_EXECUTION_SECONDS = 60;

test.describe('Organization System Delete and Undelete transaction tests @organization-advanced', () => {
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
    },
    getPages: () => ({ window, loginPage, transactionPage, organizationPage }),
    onFixtureReady: () => {},
    logoutFromOrganization: () => organizationPage.logoutFromOrganization(),
  });

  // 5.11.3
  test('Verify user can create a System Delete transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnSystemLink();
      await transactionPage.clickOnSystemDeleteTransaction();
    });

    await organizationPage.setDateTimeAheadBy(SYSTEM_TRANSACTION_EXECUTION_SECONDS);
    await transactionPage.fill('input-file-id-for-update', '0.0.111');
    await transactionPage.fill('input-contract-id', '0.0.222');
    await transactionPage.setSystemDeleteExpirationDate(SYSTEM_DELETE_EXPIRATION_DAYS);

    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);

    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();

    const transactionDetails = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('System Delete');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);
  });

  // 5.11.4
  test('Verify user can create a System Undelete transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnSystemLink();
      await transactionPage.clickOnSystemUndeleteTransaction();
    });

    await organizationPage.setDateTimeAheadBy(SYSTEM_TRANSACTION_EXECUTION_SECONDS);
    await transactionPage.fill('input-file-id-for-update', '0.0.111');
    await transactionPage.fill('input-contract-id', '0.0.222');

    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);

    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();

    const transactionDetails = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('System Undelete');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);
  });
});
