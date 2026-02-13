import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../pages/OrganizationPage.js';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { resetDbState, resetPostgresDbState, flushRateLimiter } from '../utils/databaseUtil.js';
import { signatureMapToV1Json } from '../utils/transactionUtil.js';
import {
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupApp,
  setupEnvironmentForTransactions,
  waitAndReadFile,
  waitForValidStart,
} from '../utils/util.js';
import { disableNotificationsForTestUsers } from '../utils/databaseQueries.js';
import { PrivateKey, Transaction } from '@hashgraph/sdk';
import * as path from 'node:path';
import * as fsp from 'fs/promises';
import JSZip from 'jszip';

let app: ElectronApplication;
let window: Page;
let globalCredentials = { email: '', password: '' };

let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;

let firstUser: UserDetails;
let secondUser: UserDetails;
let thirdUser: UserDetails;
let complexKeyAccountId: string;

test.describe('Organization Transaction tests', () => {
  test.beforeAll(async () => {
    test.slow();
    await resetDbState();
    await resetPostgresDbState();
    await flushRateLimiter();
    ({ app, window } = await setupApp());
    transactionPage = new TransactionPage(window);
    organizationPage = new OrganizationPage(window);
    registrationPage = new RegistrationPage(window);

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
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    await app.evaluate(({ dialog }) => {
      (dialog as unknown as { _savePath: string|null })._savePath=null;
      (dialog as unknown as { _openPaths: string[] })._openPaths=[];

      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath:  (dialog as unknown as { _savePath: string|null })?._savePath ?? '',
      });
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths:  (dialog as unknown as { _openPaths: string[] })?._openPaths ?? [],
      });
    });
  });

  test.beforeEach(async () => {
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );
  });

  test.afterEach(async () => {
    await organizationPage.logoutFromOrganization();
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
    await resetPostgresDbState();
  });

  test('Verify required signers are able to see the transaction in "Ready to Sign" status', async () => {
    const { txId, validStart } = await organizationPage.getOrCreateUpdateTransaction(
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
    const transactionDetails = await organizationPage.getReadyForSignTransactionDetails(txId ?? '');

    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStart);
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
    expect(transactionDetails2?.validStart).toBe(validStart);
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
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');

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
    await organizationPage.clickOnSignTransactionButton();

    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      thirdUser.email,
      thirdUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyToSignTab();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');

    const isSignerSignVisible = await organizationPage.isSecondSignerCheckmarkVisible();
    expect(isSignerSignVisible).toBe(true);
  });

  test('Verify transaction is shown "In progress" tab after signing', async () => {
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      30,
      true,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();

    const transactionDetails = await organizationPage.getInProgressTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('Account Update');
    expect(transactionDetails?.validStart).toBe(validStart);
    expect(transactionDetails?.detailsButton).toBe(true);
  });

  test('Verify transaction is shown "Ready for Execution" and correct stage is displayed', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'update',
      10000,
      true,
    );
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
    expect(transactionDetails?.validStart).toBe(validStart);
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
    test.slow();
    const { txId, validStart } = await organizationPage.updateAccount(
      complexKeyAccountId,
      'newUpdate',
      5,
      true,
    );
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

  test('Verify observer is listed in the transaction details', async () => {
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

  test('Verify transaction is visible for an observer while transaction is "Ready for execution"', async () => {
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

  test('Verify observer is saved in the db for the correct transaction id', async () => {
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

  test('Verify next button is visible when user has multiple txs to sign', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test('Verify user is redirected to the next transaction after clicking the next button', async () => {
    await organizationPage.createAccount(600, 0, false);
    const { txId } = await organizationPage.createAccount(600, 0, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnSubmitSignButtonByTransactionId(txId ?? '');
    await organizationPage.clickOnSignTransactionButton();
    await organizationPage.clickOnNextTransactionButton();
    const currentTxId = await organizationPage.getTransactionDetailsId();
    expect(currentTxId).not.toBe(txId);
    expect(await organizationPage.isSignTransactionButtonVisible()).toBe(true);
  });

  test('Verify next button is visible when user has multiple txs in history', async () => {
    const { txId } = await organizationPage.createAccount(1, 0, true);
    const { validStart } = await organizationPage.createAccount(3, 0, true);
    await waitForValidStart(validStart ?? '');
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnHistoryTab();
    await organizationPage.clickOnHistoryDetailsButtonByTransactionId(txId ?? '');
    expect(await organizationPage.isNextTransactionButtonVisible()).toBe(true);
  });

  test('Verify user can execute transfer transaction with complex account', async () => {
    test.slow();
    const { txId, validStart } = await organizationPage.transferAmountBetweenAccounts(
      complexKeyAccountId,
      '15',
    );
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
    test.slow();
    const { txId, validStart } = await organizationPage.approveAllowance(complexKeyAccountId, '10');
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

  test('Verify user can execute file create with complex account', async () => {
    test.slow();
    const { txId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
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
    test.slow();
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      globalCredentials,
      firstUser,
    );
    const { txId, validStart } = await organizationPage.fileUpdate(
      fileId ?? '',
      complexKeyAccountId,
      'newContent',
    );
    await organizationPage.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
    await waitForValidStart(validStart ?? '');

    const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
    expect(transactionDetails?.transactionId).toBe(txId);
    expect(transactionDetails?.transactionType).toBe('File Update');
    expect(transactionDetails?.validStart).toBeTruthy();
    expect(transactionDetails?.detailsButton).toBe(true);
    expect(transactionDetails?.status).toBe('SUCCESS');
  });

  test('Verify user can execute file append with complex account', async () => {
    test.slow();
    const { fileId } = await organizationPage.ensureComplexFileExists(
      complexKeyAccountId,
      globalCredentials,
      firstUser,
    );
    const { txId, validStart } = await organizationPage.fileAppend(
      fileId ?? '',
      complexKeyAccountId,
      'appendContent',
    );
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
    test.slow();
    const { txId, validStart } = await organizationPage.deleteAccount(complexKeyAccountId);
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

      await app.evaluate(
        ({ dialog }, { savePath }) => {
          (dialog as unknown as { _savePath: string })._savePath = savePath;
        },
        { savePath },
      );
    });

    test.afterEach(async () => {
      if (exportDir) {
        await fsp.rm(exportDir, { recursive: true, force: true });
      }
    });

    test('Verify user can export and import transaction and a large number of signatures for TTv1->TTv2 compatibility', async () => {
      test.slow();

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
      await app.evaluate(
        ({ dialog }, { openPaths }) => {
          (dialog as unknown as { _openPaths: string[] })._openPaths = openPaths;
        },
        { openPaths },
      );
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

    test('Verify user can import superfluous signatures from TTv1 format', async () => {
      test.slow();

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
      await app.evaluate(
        ({ dialog }, { openPaths }) => {
          (dialog as unknown as { _openPaths: string[] })._openPaths = openPaths;
        },
        { openPaths },
      );
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

    test('Verify user cannot import signatures without visibility of transaction from TTv1 format', async () => {
      test.slow();

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
      await app.evaluate(
        ({ dialog }, { openPaths }) => {
          (dialog as unknown as { _openPaths: string[] })._openPaths = openPaths;
        },
        { openPaths },
      );
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
