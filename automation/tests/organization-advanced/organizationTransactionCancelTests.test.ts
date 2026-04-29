import { Page, test } from '@playwright/test';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { registerOrganizationAdvancedSuiteHooks } from '../helpers/bootstrap/organizationAdvancedSuiteHooks.js';

let window: Page;

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;
let complexKeyAccountId: string;

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

// 6.3.7: A creator can cancel a multi-sig transaction while it is collecting
// signatures. The cancel flow lives on the transaction details page (handled by
// `CancelTransactionController.vue`) and toasts "Transaction canceled successfully"
// on success.
const CANCEL_SUCCESS_TOAST = 'Transaction canceled successfully';

test.describe('Organization transaction cancel tests @organization-advanced', () => {
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
    },
    getPages: () => ({ window, loginPage, transactionPage, organizationPage }),
    onFixtureReady: fixture => {
      complexKeyAccountId = fixture.complexKeyAccountId;
    },
    logoutFromOrganization: () => organizationPage.logoutFromOrganization(),
  });

  test('Verify creator can cancel an in-progress transaction', async () => {
    const { txId } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '1',
      30,
      true,
    );
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();

    await organizationPage.clickOnInProgressTab();
    await organizationPage.clickOnInProgressDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnCancelTransactionButton();
    await organizationPage.clickOnConfirmCancelButton();

    await organizationPage.waitForToastMessage(CANCEL_SUCCESS_TOAST);
  });
});
