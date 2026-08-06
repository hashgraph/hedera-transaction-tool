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

// A valid DER-encoded Ed25519 public key used as the admin key for NodeCreate.
// The node is never executed, so the key does not need to correspond to a real signer.
const TEST_ADMIN_KEY =
  '302a300506032b6570032100e0c8ec2758a5879ffac226a13bef062a83dcb0f7b3b5e5b16c1ef4df41e09f9';

test.describe('Organization node transaction tests @organization-advanced', () => {
  registerOrganizationAdvancedSuiteHooks({
    resolveOrganizationNickname,
    onSuiteReady: suite => {
      ({ window, loginPage, transactionPage, organizationPage } = suite);
    },
    getPages: () => ({ window, loginPage, transactionPage, organizationPage }),
    onFixtureReady: () => {},
    logoutFromOrganization: () => organizationPage.logoutFromOrganization(),
  });

  test('Verify user can create a Node Delete transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnNodeServiceLink();
      await transactionPage.clickOnNodeDeleteTransaction();
    });
    await organizationPage.setDateTimeAheadBy(60);
    await transactionPage.fillNodeId('0');
    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const details = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(details?.transactionId).toBe(txId);
    expect(details?.transactionType).toBe('Node Delete');
    expect(details?.validStart).toBe(validStartTime);
    expect(details?.detailsButton).toBe(true);
  });

  test('Verify user can create a Node Update transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnNodeServiceLink();
      await transactionPage.clickOnNodeUpdateTransaction();
    });
    await organizationPage.setDateTimeAheadBy(60);
    await transactionPage.fillNodeId('0');
    // Wait for the mirror-node lookup to resolve and populate the form fields,
    // then change the description so hasAnyChange becomes true.
    await transactionPage.waitForNodeInfoToLoad();
    await transactionPage.fillNodeDescription('test-automation-node-update');
    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const details = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(details?.transactionId).toBe(txId);
    expect(details?.transactionType).toBe('Node Update');
    expect(details?.validStart).toBe(validStartTime);
    expect(details?.detailsButton).toBe(true);
  });

  test('Verify user can create a Node Create transaction', async () => {
    await organizationPage.startNewTransaction(async () => {
      await transactionPage.clickOnNodeServiceLink();
      await transactionPage.clickOnNodeCreateTransaction();
    });
    await organizationPage.setDateTimeAheadBy(60);
    await transactionPage.fillNodeAccountId('0.0.3');
    await transactionPage.addGossipEndpoint('127.0.0.1', '50211');
    await transactionPage.addServiceEndpoint('127.0.0.1', '50211');
    // Fill admin key last — createDisabled clears once it is set.
    await transactionPage.fillInPublicKeyForAccount(TEST_ADMIN_KEY);
    const { txId, validStart } = await organizationPage.processTransaction();
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const details = await organizationPage.getReadyForExecutionTransactionDetails(txId ?? '');
    expect(details?.transactionId).toBe(txId);
    expect(details?.transactionType).toBe('Node Create');
    expect(details?.validStart).toBe(validStartTime);
    expect(details?.detailsButton).toBe(true);
  });
});
