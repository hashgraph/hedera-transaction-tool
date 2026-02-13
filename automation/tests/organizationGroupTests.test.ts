import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { GroupPage } from '../pages/GroupPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { resetDbState, resetPostgresDbState, flushRateLimiter } from '../utils/databaseUtil.js';
import {
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupApp,
  setupEnvironmentForTransactions,
} from '../utils/util.js';
import { disableNotificationsForTestUsers } from '../utils/databaseQueries.js';

let app: ElectronApplication;
let window: Page;
let globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;

let firstUser: UserDetails
let secondUser: UserDetails
let thirdUser: UserDetails
let complexKeyAccountId: string;
let newAccountId: string;

function incrementAccountId(accountId: string) {
  const parts = accountId.split('.');
  const lastIndex = parts.length - 1;
  parts[lastIndex] = (parseInt(parts[lastIndex], 10) + 1).toString();
  return parts.join('.');
}

test.describe('Organization Group Tx tests', () => {
  test.beforeAll(async () => {
    test.slow();
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);
    groupPage = new GroupPage(window);

    organizationPage.complexFileId = [];

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Generate test users in PostgreSQL database for organizations
    await organizationPage.createUsers(3);

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);

    // Setup Organization
    await organizationPage.setupOrganization();
    await organizationPage.setUpInitialUsers(window, globalCredentials.password);

    // Disable notifications for test users
    await disableNotificationsForTestUsers();

    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);
    thirdUser = organizationPage.getUser(2);
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountForTransactions();
    complexKeyAccountId = organizationPage.getComplexAccountId();
    await organizationPage.addComplexKeyAccountForTransactions();
    newAccountId = organizationPage.complexAccountId[1];
    groupPage.organizationPage = organizationPage;
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
  });

  test.beforeEach(async () => {
    // Flush rate limiter before each test to prevent "too many requests" errors
    await flushRateLimiter();

    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // Wait for login toast to disappear before test starts
    await groupPage.waitForElementToDisappear('.v-toast__text');

    await transactionPage.clickOnTransactionsMenuButton();

    //this is needed because tests fail in CI environment
    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await groupPage.closeDraftTransactionModal();
    await groupPage.closeGroupDraftModal();
    await groupPage.deleteGroupModal();

    await groupPage.navigateToGroupTransaction();

    // Handle modals that may appear after navigation
    await groupPage.closeGroupDraftModal();  // "Save Group?" modal
    await groupPage.deleteGroupModal();       // "Group Contains No Transactions" modal
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify user can execute group transaction in organization', async () => {
    test.slow();
    await groupPage.addOrgAllowanceTransactionToGroup(2, complexKeyAccountId, '10');

    await groupPage.clickOnSignAndExecuteButton();
    const txId = await groupPage.getTransactionTimestamp(0) ?? '';
    const secondTxId = await groupPage.getTransactionTimestamp(1) ?? '';
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupPage.clickOnSignAllButton();
    await groupPage.clickOnConfirmGroupActionButton()
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
    test.slow();
    await groupPage.addSingleTransactionToGroup(2);

    await groupPage.clickOnSignAndExecuteButton();
    await groupPage.clickOnConfirmGroupTransactionButton();
    await groupPage.clickOnCancelAllButton();
    await groupPage.clickOnConfirmGroupActionButton()
    await loginPage.waitForToastToDisappear();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab()
    expect(await groupPage.isEmptyTransactionTextVisible()).toBe(true);
  });

  test(`Verify user can import csv with 5 transactions`, async () => {
    test.slow();
    const isAllTransactionsSuccessful = await executeGroupFromCsvFile(5, false)
    expect(isAllTransactionsSuccessful).toBe(true);
  });

  test(`Verify user can import csv with 100 transactions`, async () => {
    test.slow();
    const isAllTransactionsSuccessful = await executeGroupFromCsvFile(100, true)
    expect(isAllTransactionsSuccessful).toBe(true);
  });

  const executeGroupFromCsvFile = async (numberOfTransactions: number, signAll: boolean): Promise<boolean> => {
    await groupPage.fillDescription('test');
    await groupPage.generateAndImportCsvFile(complexKeyAccountId, newAccountId, numberOfTransactions,);
    const message = await groupPage.getToastMessage();
    expect(message).toBe('Import complete');
    await groupPage.clickOnSignAndExecuteButton();
    await groupPage.clickOnConfirmGroupTransactionButton();
    const timestamps = await groupPage.getAllTransactionTimestamps(numberOfTransactions);
    await groupPage.clickOnSignAllButton();
    await groupPage.clickOnConfirmGroupActionButton()
    await loginPage.waitForToastToDisappear();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
    await groupPage.logInAndSignGroupTransactionsByAllUsers(globalCredentials.password, signAll);
    await organizationPage.signInOrganization(firstUser.email, firstUser.password, globalCredentials.password);
    return groupPage.verifyAllTransactionsAreSuccessful(timestamps);
  }

  test('Verify import fails if sender account does not exist on network', async () => {
    test.slow();
    await groupPage.fillDescription('test');
    // create a non-existing account Id
    const senderAccountId = incrementAccountId(newAccountId);
    await groupPage.generateAndImportCsvFile(senderAccountId, newAccountId, 5);
    const message = await groupPage.getToastMessage(true);
    expect(message).toBe(`Sender account ${senderAccountId} does not exist on network. Review the CSV file.`);
  });

  test('Verify import fails if fee payer account does not exist on network', async () => {
    test.slow();
    await groupPage.fillDescription('test');
    const feePayerAccountId = incrementAccountId(newAccountId);
    await groupPage.generateAndImportCsvFile(complexKeyAccountId, newAccountId, 5, feePayerAccountId);
    const message = await groupPage.getToastMessage(true);
    expect(message).toBe(`Fee payer account ${feePayerAccountId} does not exist on network. Review the CSV file.`);
  });

  test('Verify import fails if receiver account does not exist on network', async () => {
    test.slow();
    await groupPage.fillDescription('test');
    const receiverAccountId = incrementAccountId(newAccountId);
    await groupPage.generateAndImportCsvFile(complexKeyAccountId, receiverAccountId, 5);
    const message = await groupPage.getToastMessage(true);
    expect(message).toBe(`Receiver account ${receiverAccountId} does not exist on network. Review the CSV file.`);
  });
});
