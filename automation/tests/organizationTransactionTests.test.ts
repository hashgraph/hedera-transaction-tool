import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { flushRateLimiter } from '../utils/databaseUtil.js';
import { signatureMapToV1Json } from '../utils/transactionUtil.js';
import {
  closeApp,
  setDialogMockState,
  setupApp,
  waitAndReadFile,
  waitForValidStart,
} from '../utils/automationSupport.js';
import { disableNotificationsForUsers } from '../utils/databaseQueries.js';
import { PrivateKey, Transaction } from '@hiero-ledger/sdk';
import * as path from 'node:path';
import * as fsp from 'fs/promises';
import JSZip from 'jszip';
import { createSeededOrganizationSession } from '../utils/organizationBaseline.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  createNamespacedLabel,
  resetBackendStateForSuite,
  resetBackendStateForTeardown,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../utils/sharedTestEnvironment.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let globalCredentials = { email: '', password: '' };

let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let firstUser: UserDetails;
let secondUser: UserDetails;
let thirdUser: UserDetails;
let complexKeyAccountId: string;

test.describe('Organization Transaction tests @organization-advanced', () => {
  test.describe.configure({ mode: 'serial' });

  test.slow();
  test.beforeAll(async () => {
    isolationContext = await activateSuiteIsolation(test.info());
    organizationNickname = createNamespacedLabel('Test Organization', isolationContext);
    await resetLocalStateForSuite();
    await resetBackendStateForSuite();
    ({ app, window } = await setupApp());
    // Capture browser console logs to see [TXD-DBG] instrumentation
    window.on('console', msg => {
      const text = msg.text();
      if (
        text.includes('[TXD-DBG]') ||
        text.includes('[SIG-AUDIT-DBG]') ||
        text.includes('[ORG-USER-DBG]')
      ) {
        console.log('[BROWSER]', text);
      }
    });
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);
    loginPage = new LoginPage(window);

    organizationPage.complexFileId = [];
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 3,
        organizationNickname,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;

    firstUser = organizationPage.getUser(0);
    secondUser = organizationPage.getUser(1);
    thirdUser = organizationPage.getUser(2);
    await disableNotificationsForUsers([firstUser.email, secondUser.email, thirdUser.email]);

    // Set complex account for transactions
    await organizationPage.addComplexKeyAccountForTransactions();

    complexKeyAccountId = organizationPage.getComplexAccountId();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();
  });

  test.beforeEach(async () => {
    // Flush rate limiter before each test to prevent "too many requests" errors
    await flushRateLimiter();
    await setDialogMockState(window, { savePath: null, openPaths: [] });

    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // Wait for login toast to disappear before test starts
    await organizationPage.waitForElementToDisappear('.v-toast__text');

    // Close any draft modals that may appear
    await organizationPage.closeDraftModal();

    // CI environment stabilization
    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await resetBackendStateForTeardown();
    await cleanupIsolation(isolationContext);
  });

  test('Verify required signers are able to see the transaction in "Ready to Sign" status', async () => {
    const { txId, validStart } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    const transactionDetails = await organizationPage.getReadyForSignTransactionDetails(txId ?? '');

    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    const transactionDetails2 = await organizationPage.getReadyForSignTransactionDetails(
      txId ?? '',
    );
    expect(transactionDetails2?.transactionId).toBe(txId);
    expect(transactionDetails2?.transactionType).toBe('Account Update');
    expect(transactionDetails2?.validStart).toBe(validStartTime);
    expect(transactionDetails2?.detailsButton).toBe(true);
  });

  test('Verify the transaction is displayed in the proper status(collecting signatures)', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');

    const isStageOneCompleted = await organizationPage.isTransactionStageCompleted(0);
    expect(isStageOneCompleted).toBe(true);

    const isStageTwoActive = await organizationPage.isTransactionStageCompleted(1);
    expect(isStageTwoActive).toBe(false);
  });

  test('Verify user is shown as signed by participants', async () => {
    const { txId } = await organizationPage.getOrCreateUpdateTransaction(
      complexKeyAccountId,
      'update',
      1000,
      false,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');
    await organizationPage.waitForElementToDisappear('.v-toast__text');

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');

    const isSignerSignVisible = await organizationPage.isSecondSignerCheckmarkVisible();
    expect(isSignerSignVisible).toBe(true);
  });

  test('Verify transaction is shown "In progress" tab after signing', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(complexKeyAccountId, 'update', 30, true);
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);
  });

  test('Verify transaction is shown "History" tab after canceling and cannot be signed again', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(complexKeyAccountId, 'update', 30, true);
    const validStartTime = await organizationPage.getValidStartTimeOnly(validStart);
    await organizationPage.closeDraftModal();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStartTime);
    expect(transactionDetails?.detailsButton).toBe(true);

    await organizationPage.clickOnInProgressDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnCancelTransactionButton();
    await organizationPage.clickOnConfirmCancelButton();
    await expect
      .poll(() => organizationPage.isSignTransactionButtonVisible(), { timeout: 10000 })
      .toBe(false);

    await organizationPage.logoutFromOrganization();
    // Now signs in as every user and verifies that no sign action is enabled for txId
    for (const user of organizationPage.users) {
      await organizationPage.fillInLoginDetailsAndClickSignIn(user.email, user.password);
      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.clickOnHistoryTab();
      const historyDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(historyDetails?.transactionId).toBe(txId);
      expect(historyDetails?.transactionType).toBe('Account Update');
      expect(historyDetails?.validStart).toBe('N/A');
      expect(historyDetails?.status).toBe('CANCELED');
      expect(historyDetails?.detailsButton).toBe(true);
      await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
      expect(await organizationPage.isSignTransactionButtonVisible()).toBe(false);
      await organizationPage.logoutFromOrganization();
    }

    // Signs in again as user 0 to enable logout in afterEach() callback
    const user0 = organizationPage.users[0];
    await organizationPage.fillInLoginDetailsAndClickSignIn(user0.email, user0.password);
  });

  test('Verify transaction is shown "Ready for Execution" and correct stage is displayed', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(complexKeyAccountId, 'update', 600, true);
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
    await waitForValidStart(validStart ?? '');
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
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

  test('Verify transaction is not visible if user is not an observer', async () => {
    const { txId } = await organizationPage.createAccount();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(
      txId ?? '',
      5,
    );
    expect(isTransactionVisible).toBe(false);
  });

  test.skip('Verify observer is listed in the transaction details', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 1);
    const firstObserver = await organizationPage.getObserverEmail(0);
    expect(selectedObservers).toBe(firstObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify transaction is visible for an observer while transaction is "In progress"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    expect(typeof selectedObservers).toBe('string');
    await organizationPage.signInOrganization(
      selectedObservers as string,
      organizationPage.getUserPasswordByEmail(selectedObservers as string),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(
      txId ?? '',
    );
    expect(isTransactionVisible).toBe(true);
  });

  test.skip('Verify transaction is visible for an observer while transaction is "Ready for execution"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1, true);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    expect(typeof selectedObservers).toBe('string');
    await organizationPage.signInOrganization(
      selectedObservers as string,
      organizationPage.getUserPasswordByEmail(selectedObservers as string),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleReadyForExecution(
      txId ?? '',
    );
    expect(isTransactionVisible).toBe(true);
  });

  test.skip('Verify observer is saved in the db for the correct transaction id', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1);
    expect(typeof selectedObservers).toBe('string');
    const userIdInDb = await organizationPage.getUserIdByEmail(selectedObservers as string);
    const txIdForObserver = await organizationPage.getAllTransactionIdsForUserObserver(userIdInDb);
    expect(txIdForObserver).toContain(txId);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify user can add multiple observers', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 2, false);
    const firstObserver = await organizationPage.getObserverEmail(0);
    const secondObserver = await organizationPage.getObserverEmail(1);
    expect(selectedObservers?.length).toBeGreaterThan(1);
    expect(selectedObservers?.[0]).toBe(firstObserver);
    expect(selectedObservers?.[1]).toBe(secondObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test.skip('Verify next button is visible when user has multiple txs to sign', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    // Use Details button to open transaction details, then sign from there
    // (Sign button on row signs directly without opening details page)
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test.skip('Verify user is redirected to the next transaction after clicking the next button', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    // Use Details button to open transaction details, then sign from there
    // (Sign button on row signs directly without opening details page)
    await organizationPage.clickOnReadyToSignDetailsButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    await organizationPage.clickOnNextTransactionButton();
    const currentTxId = await organizationPage.getTransactionDetailsId();
    expect(currentTxId).not.toBe(txId);
    expect(await organizationPage.isSignTransactionButtonVisible()).toBe(true);
  });

  test.skip('Verify next button is visible when user has multiple txs in history', async () => {
    const { txId } = await organizationPage.createAccount(1, 0, true);
    await organizationPage.closeDraftModal();
    const { validStart } = await organizationPage.createAccount(3, 0, true);
    await organizationPage.closeDraftModal();
    await waitForValidStart(validStart ?? '');
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();
    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
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
      600, // 10 minutes - enough time for all users to sign
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
      600, // 10 minutes - enough time for all users to sign
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
      600, // 10 minutes - enough time for all users to sign
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

  test.describe('TTv1->TTv2 signature import/export compatibility', () => {
    let exportDir: string;
    let savePath: string;
    let transactionPath: string;

    test.beforeEach(async () => {
      exportDir = path.join('/tmp', 'transaction-output');
      savePath = path.join(exportDir, 'transaction.tx');
      transactionPath = path.join(exportDir, 'transaction.tx');
      await fsp.rm(exportDir, { recursive: true, force: true });
      await fsp.mkdir(exportDir, { recursive: true });

      await setDialogMockState(window, { savePath });
    });

    test.afterEach(async () => {
      if (exportDir) {
        await fsp.rm(exportDir, { recursive: true, force: true });
      }
    });

    test.skip('Verify user can export and import transaction and a large number of signatures for TTv1->TTv2 compatibility', async () => {
      // Create 73 more users, a total of 76
      await organizationPage.createAdditionalUsers(73, globalCredentials.password);

      // Create an account with a complex key for users[1-75]
      const newAccountId = (await organizationPage.createComplexKeyAccountForUsers(75)) ?? '';

      // Create transaction to export
      await transactionPage.clickOnTransactionsMenuButton();
      const { txId, validStart } = await organizationPage.createAccountWithFeePayerId(newAccountId);

      // export transaction
      await transactionPage.clickOnExportTransactionButton('Export');

      // Read the .tx file and sign it with required signatures, saving those signatures to json files in appropriate zips
      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      const openPaths = [];
      for (let i = 1; i < 76; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        // Zip up the signatures
        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      // import signatures
      await setDialogMockState(window, { openPaths });
      await transactionPage.importV1Signatures();

      // Wait for the transaction to execute
      await waitForValidStart(validStart ?? '');

      // Verify transaction is in history with SUCCESS status
      await organizationPage.clickOnHistoryTab();
      const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(transactionDetails?.transactionId).toBe(txId);
      expect(transactionDetails?.transactionType).toBe('Account Create');
      expect(transactionDetails?.validStart).toBeTruthy();
      expect(transactionDetails?.detailsButton).toBe(true);
      expect(transactionDetails?.status).toBe('SUCCESS');
    });

    test.skip('Verify user can import superfluous signatures from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(1, globalCredentials.password);

      // Create transaction to export
      const { txId, validStart } =
        await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      // export transaction
      await transactionPage.clickOnExportTransactionButton('Export');

      // Read the .tx file and sign it with required signatures, saving those signatures to json files in appropriate zips
      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      // Start with 1, user 0 will sign after
      const openPaths = [];
      for (let i = 1; i < 4; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        // Zip up the signatures
        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      // Sign the transaction as the fee payer
      await organizationPage.clickOnSignTransactionButton();

      // import signatures
      await setDialogMockState(window, { openPaths });
      await transactionPage.importV1Signatures();

      // Wait for the transaction to execute
      await waitForValidStart(validStart ?? '');

      // Verify transaction is in history with SUCCESS status
      await organizationPage.clickOnHistoryTab();
      const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(transactionDetails?.transactionId).toBe(txId);
      expect(transactionDetails?.transactionType).toBe('Account Create');
      expect(transactionDetails?.validStart).toBeTruthy();
      expect(transactionDetails?.detailsButton).toBe(true);
      expect(transactionDetails?.status).toBe('SUCCESS');
    });

    test.skip('Verify user cannot import signatures without visibility of transaction from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(1, globalCredentials.password);

      // Create transaction to export
      await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      // export transaction
      await transactionPage.clickOnExportTransactionButton('Export');

      // Read the .tx file and sign it with required signatures, saving those signatures to json files in appropriate zips
      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      const openPaths = [];
      for (let i = 0; i < 3; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        // Zip up the signatures
        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      //switch users
      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.logoutFromOrganization();

      const fourthUser = organizationPage.getUser(3);
      await organizationPage.signInOrganization(
        fourthUser.email,
        fourthUser.password,
        globalCredentials.password,
      );

      // import signatures
      await setDialogMockState(window, { openPaths });
      await transactionPage.clickOnTransactionsMenuButton();
      await transactionPage.clickOnImportButton();
      //expect import button is disabled
      expect(await transactionPage.isConfirmImportButtonDisabled()).toBe(true);
      //close modal so test can finish
      // Press Escape to close modal, allowing test to finish
      await window.keyboard.press('Escape');
    });
  });
});
