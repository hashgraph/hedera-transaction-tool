import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { GroupPage } from '../../pages/GroupPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { findMissingAccountId } from '../../utils/network/mirrorNodeAPI.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupOrganizationAdvancedFixture } from '../helpers/fixtures/organizationAdvancedFixture.js';
import { executeOrganizationGroupFromCsvFile } from '../helpers/flows/organizationGroupFlow.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { prepareGroupTransactionPage } from '../helpers/flows/groupTransactionNavigationFlow.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;
let globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let organizationPage: OrganizationPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let firstUser: UserDetails
let secondUser: UserDetails
let thirdUser: UserDetails
let complexKeyAccountId: string;
let newAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Group Tx tests @organization-advanced', () => {
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
    groupPage = new GroupPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    // Flush rate limiter before each test to prevent "too many requests" errors
    await flushRateLimiter();

    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const fixture = await setupOrganizationAdvancedFixture(
      window,
      loginPage,
      organizationPage,
      organizationNickname,
      true,
    );
    globalCredentials.email = fixture.localCredentials.email;
    globalCredentials.password = fixture.localCredentials.password;
    firstUser = fixture.firstUser;
    secondUser = fixture.secondUser;
    thirdUser = fixture.thirdUser;
    complexKeyAccountId = fixture.complexKeyAccountId;
    newAccountId = fixture.secondaryComplexKeyAccountId ?? '';
    groupPage.organizationPage = organizationPage;

    await groupPage.waitForElementToDisappear(groupPage.toastMessageSelector);
    await prepareGroupTransactionPage({
      transactionPage,
      groupPage,
      closePostNavigationModals: true,
    });
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Group tests can end in intermediary modal states.
      // The next beforeEach recreates the org fixture from scratch.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify user can execute group transaction in organization', async () => {
    await groupPage.addOrgAllowanceTransactionToGroup(2, complexKeyAccountId, '10');
    await groupPage.clickOnSignAndExecuteButton();
    await groupPage.closeGroupDraftModal();

    const txId = await groupPage.getTransactionTimestamp(0, 100) ?? '';
    const secondTxId = (await groupPage.getTransactionTimestamp(1, 100)) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupPage.clickOnSignAllButton();
    await groupPage.clickOnConfirmSignAllButton();
    await loginPage.waitForToastToDisappear();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await groupPage.logInAndSignGroupTransactionsByAllUsers(globalCredentials.password);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(txId);
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(result).toBe('SUCCESS');

    const secondTransactionDetails = await transactionPage.mirrorGetTransactionResponse(secondTxId);
    const secondTransactionType = secondTransactionDetails?.name;
    const secondResult = secondTransactionDetails?.result;
    expect(secondTransactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(secondResult).toBe('SUCCESS');
  });

  test('Verify user can cancel all items in a transaction group', async () => {
    await groupPage.addSingleTransactionToGroup(2);
    await groupPage.clickOnSignAndExecuteButton();
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupPage.clickOnCancelAllButton();
    await groupPage.clickOnConfirmCancelAllButton();
    await loginPage.waitForToastToDisappear();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    expect(await groupPage.isEmptyTransactionTextVisible()).toBe(true);
  });

  test(`Verify user can import csv with 5 transactions`, async () => {
    const isAllTransactionsSuccessful = await executeOrganizationGroupFromCsvFile({
      groupPage,
      loginPage,
      organizationPage,
      transactionPage,
      firstUser,
      encryptionPassword: globalCredentials.password,
      senderAccountId: complexKeyAccountId,
      receiverAccountId: newAccountId,
      numberOfTransactions: 5,
      signAll: false,
    });
    expect(isAllTransactionsSuccessful).toBe(true);
  });

  test(`Verify user can import csv with 100 transactions`, async () => {
    const isAllTransactionsSuccessful = await executeOrganizationGroupFromCsvFile({
      groupPage,
      loginPage,
      organizationPage,
      transactionPage,
      firstUser,
      encryptionPassword: globalCredentials.password,
      senderAccountId: complexKeyAccountId,
      receiverAccountId: newAccountId,
      numberOfTransactions: 100,
      signAll: true,
    });
    expect(isAllTransactionsSuccessful).toBe(true);
  });

  test('Verify import fails if sender account does not exist on network', async () => {
    await groupPage.fillDescription('test');
    const senderAccountId = await findMissingAccountId(newAccountId);
    const message = await groupPage.importCsvExpectingError(senderAccountId, newAccountId, 5);
    expect(message).toBe(`Sender account ${senderAccountId} does not exist on network. Review the CSV file.`);
  });

  test('Verify import fails if fee payer account does not exist on network', async () => {
    await groupPage.fillDescription('test');
    const feePayerAccountId = await findMissingAccountId(newAccountId);
    const message = await groupPage.importCsvExpectingError(complexKeyAccountId, newAccountId, 5, feePayerAccountId);
    expect(message).toBe(`Fee payer account ${feePayerAccountId} does not exist on network. Review the CSV file.`);
  });

  test('Verify import fails if receiver account does not exist on network', async () => {
    await groupPage.fillDescription('test');
    const receiverAccountId = await findMissingAccountId(newAccountId);
    const message = await groupPage.importCsvExpectingError(complexKeyAccountId, receiverAccountId, 5);
    expect(message).toBe(`Receiver account ${receiverAccountId} does not exist on network. Review the CSV file.`);
  });
});
