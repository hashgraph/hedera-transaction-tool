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

test.describe('Organization Freeze transaction tests @organization-advanced', () => {
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
    },
    getPages: () => ({ window, loginPage, transactionPage, organizationPage }),
    onFixtureReady: () => {},
    logoutFromOrganization: () => organizationPage.logoutFromOrganization(),
  });

  // 5.12.1: User can create a Freeze transaction.
  // Uses "Freeze Abort" (type 4) — no start time or file info required — so
  // the sign/submit button is enabled without additional field setup.
  test('Verify user can create a Freeze transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnFreezeTransaction();
    });
    await organizationPage.setDateTimeAheadBy(60);
    await transactionPage.selectFreezeType('4');

    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();

    const details = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(details?.transactionId).toBe(txId);
    expect(details?.transactionType).toBe('Freeze');
    expect(details?.validStart).toBe(validStartTime);
    expect(details?.detailsButton).toBe(true);
  });
});
