/*
const { test, expect } = require('playwright/test');
const {
  setupApp,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const AccountPage = require('../pages/AccountPage');
const FilePage = require('../pages/FilePage');
const DetailsPage = require('../pages/DetailsPage');
const { resetDbState } = require('../utils/databaseUtil');
*/

import { ElectronApplication, expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { resetDbState } from '../utils/databaseUtil.js';
import {
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupApp,
  setupEnvironmentForTransactions,
  resetAppState,
} from '../utils/util.js';
import { AccountPage } from '../pages/AccountPage.js';
import { FilePage } from '../pages/FilePage.js';
import { DetailsPage } from '../pages/DetailsPage.js';

let app: ElectronApplication;
let window: Page;
const globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let accountPage: AccountPage;
let filePage: FilePage;
let detailsPage: DetailsPage;

test.describe('Workflow tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    accountPage = new AccountPage(window);
    filePage = new FilePage(window);
    detailsPage = new DetailsPage(window);
    registrationPage = new RegistrationPage(window);

    // Ensure transactionPage generatedAccounts is empty
    transactionPage.generatedAccounts = [];

    // Check if we need to reset app state (if user exists from previous run)
    const isSettingsButtonVisible = await loginPage.isSettingsButtonVisible();
    if (isSettingsButtonVisible) {
      console.log('Existing user detected, resetting app state...');
      await resetAppState(window, app);
    }

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window);
  });

  test.afterAll(async () => {
    // Ensure transactionPage generatedAccounts is empty
    transactionPage.generatedAccounts = [];
    await closeApp(app);
    await resetDbState();
  });

  test.beforeEach(async () => {
    // Wait for any ongoing operations to complete
    await window.waitForLoadState('networkidle');

    // Ensure menu button is visible before clicking
    await transactionPage.waitForElementToBeVisible(
      transactionPage.transactionsMenuButtonSelector,
      5000,
    );
    await transactionPage.clickOnTransactionsMenuButton();

    // Additional wait for CI environment stability
    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for page to stabilize after navigation
    await window.waitForLoadState('networkidle');
    await transactionPage.closeDraftModal();
  });

  test('Verify account card is visible with valid information', async () => {
    const initialHbarFunds = '1';
    const memoText = 'test memo';
    const maxAutoAssociations = 23;

    const { newAccountId } = await transactionPage.createNewAccount({
      initialFunds: initialHbarFunds,
      memo: memoText,
      maxAutoAssociations: maxAutoAssociations,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const evmAddressFromMirrorNode = accountDetails.accounts[0]?.evm_address;
    const keyAddressFromMirrorNode = accountDetails.accounts[0]?.key?.key;
    const keyTypeFromMirrorNode = accountDetails.accounts[0]?.key?._type;
    const normalizedKeyTypeFromMirrorNode =
      keyTypeFromMirrorNode === 'ECDSA_SECP256K1' ? 'secp256k1' : keyTypeFromMirrorNode;
    const maxAutoAssociationsFromMirrorNode =
      accountDetails.accounts[0]?.max_automatic_token_associations;
    const ethereumNonceFromMirrorNode = accountDetails.accounts[0]?.ethereum_nonce;
    const autoRenewPeriodFromMirrorNode = accountDetails.accounts[0]?.auto_renew_period;

    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();

    const accountId = await accountPage.getAccountIdText();
    expect(accountId).toContain(newAccountId);

    const evmAddress = ((await accountPage.getEvmAddressText()) ?? '').trim();
    expect(evmAddress).toBe(evmAddressFromMirrorNode);

    const balance = ((await accountPage.getBalanceText()) ?? '').trim();
    expect(balance).toContain(initialHbarFunds);

    const key = ((await accountPage.getKeyText()) ?? '').trim();
    expect(key).toBe(keyAddressFromMirrorNode);

    const keyType = ((await accountPage.getKeyTypeText()) ?? '').trim();
    expect(normalizedKeyTypeFromMirrorNode).toContain(keyType);

    const receiverSigRequiredText = ((await accountPage.getReceiverSigRequiredText()) ?? '').trim();
    expect(receiverSigRequiredText).toBe('No');

    const memo = ((await accountPage.getMemoText()) ?? '').trim();
    expect(memo).toBe(memoText);

    const maxAutoAssociationsText = ((await accountPage.getMaxAutoAssocText()) ?? '').trim();
    expect(maxAutoAssociationsText).toBe(maxAutoAssociationsFromMirrorNode.toString());

    const ethereumNonceText = ((await accountPage.getEthereumNonceText()) ?? '').trim();
    expect(ethereumNonceText).toBe(ethereumNonceFromMirrorNode.toString());

    const createdAtText = ((await accountPage.getCreatedAtText()) ?? '').trim();
    expect(createdAtText).toBeTruthy();

    const expiresAtText = ((await accountPage.getExpiresAtText()) ?? '').trim();
    expect(expiresAtText).toBeTruthy();

    const autoRenewPeriodText = ((await accountPage.getAutoRenewPeriodText()) ?? '').trim();
    expect(autoRenewPeriodText).toContain(autoRenewPeriodFromMirrorNode.toString());

    const stakedToText = ((await accountPage.getStakedToText()) ?? '').trim();
    expect(stakedToText).toBe('None');

    const pendingRewardText = ((await accountPage.getPendingRewardText()) ?? '').trim();
    expect(pendingRewardText).toBe('0 ℏ');

    const rewardsText = ((await accountPage.getRewardsText()) ?? '').trim();
    expect(rewardsText).toBe('Accepted');
  });

  test('Verify clicking on "Create New" button navigates the user on create account tx page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnCreateNewLink();

    const isSignAndSubmitButtonVisible = await transactionPage.isSignAndSubmitButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);
  });

  test('Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnUpdateInNetworkLink();

    const isSignAndSubmitButtonVisible = await transactionPage.isSignAndSubmitButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);

    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInUpdatePage();
    expect(isAccountIdPrefilled).toContain(accountFromList);
  });

  test('Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnDeleteFromNetworkLink();

    const isTransferAccountIdVisible = await transactionPage.isTransferAccountIdVisible();
    expect(isTransferAccountIdVisible).toBe(true);

    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInDeletePage();
    expect(isAccountIdPrefilled).toContain(accountFromList);
  });

  test('Verify user can unlink accounts', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.clickOnTransactionsMenuButton();
    const { newAccountId } = await transactionPage.createNewAccount();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnSelectManyAccountsButton();
    await accountPage.clickOnAccountCheckbox(accountFromList);
    await accountPage.clickOnAccountCheckbox(newAccountId ?? '');
    await loginPage.waitForToastToDisappear();
    await accountPage.clickOnRemoveMultipleButton();
    await accountPage.unlinkAccounts();
    const toastText = await registrationPage.getToastMessage();
    expect(toastText).toBe('Account Unlinked!');
  });

  test('Verify user can add an existing account', async () => {
    await accountPage.ensureAccountExistsAndUnlinked();
    const accountFromList = await accountPage.getFirstAccountFromUnlinkedList();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnAddExistingLink();
    await accountPage.fillInExistingAccountId(accountFromList);
    await accountPage.clickOnLinkAccountButton();
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();

    const isAccountCardVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isAccountCardVisible).toBe(true);
  });

  test('Verify file card is visible with valid information', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    const fileId = await filePage.getFileIdText();
    expect(fileId).toBeTruthy();

    const fileSize = await filePage.getFileSizeText();
    expect(fileSize).toBeTruthy();

    const fileKey = await filePage.getFileKeyText();
    expect(fileKey).toBeTruthy();

    const fileKeyType = await filePage.getFileKeyTypeText();
    expect(fileKeyType).toBeTruthy();

    const fileMemo = await filePage.getFileMemoText();
    expect(fileMemo).toBeTruthy();

    const fileLedger = await filePage.getFileLedgerText();
    expect(fileLedger).toBeTruthy();

    const fileExpiration = await filePage.getFileExpirationText();
    expect(fileExpiration).toBeTruthy();

    const fileDescription = await filePage.getFileDescriptionText();
    expect(fileDescription).toBeTruthy();
  });

  test('Verify file card update flow leads to update page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnUpdateFileButton();
    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromUpdatePage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Update Transaction');
  });

  test('Verify file card append flow leads to append page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnAppendFileButton();
    const fileIdFromAppendPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromAppendPage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Append Transaction');
  });

  test('Verify file card read flow leads to read page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnReadFileButton();
    const fileIdFromAppendPage = await transactionPage.getFileIdFromReadPage();
    expect(fileId).toBe(fileIdFromAppendPage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Read File Query');
  });

  test('Verify clicking on "Add new" and "Create new" navigates the user to create new file transaction page', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnCreateNewFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Create Transaction');
  });

  test('Verify clicking on "Add new" and "Update" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnUpdateFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Update Transaction');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify clicking on "Add new" and "Append" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnAppendFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Append Transaction');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromAppendPage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify clicking on "Add new" and "Read" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnReadFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Read File Query');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromReadPage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify user can unlink multiple files', async () => {
    await transactionPage.ensureFileExists('test');
    await filePage.clickOnFilesMenuButton();
    const fileFromPage = (await filePage.getFirstFileIdFromPage()) ?? '';
    const { fileId } = await transactionPage.createFile('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnSelectManyFilesButton();
    await filePage.clickOnFileCheckbox(fileFromPage ?? '');
    await filePage.clickOnFileCheckbox(fileId ?? '');
    await filePage.clickOnRemoveMultipleButton();
    await filePage.clickOnConfirmUnlinkFileButton();

    await filePage.addFileToUnliked(fileFromPage ?? '');
    await filePage.addFileToUnliked(fileId ?? '');
    await loginPage.waitForToastToDisappear();

    const isFileCardHidden = await filePage.isFileCardHidden(fileId ?? '');
    expect(isFileCardHidden).toBe(true);

    const isSecondFileCardHidden = await filePage.isFileCardHidden(fileFromPage);
    expect(isSecondFileCardHidden).toBe(true);
  });

  test('Verify user can add an existing file to files card', async () => {
    await filePage.ensureFileExistsAndUnlinked();
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewButtonForFile();
    await filePage.clickOnAddExistingFileLink();
    const fileFromList = await filePage.getFirstFileFromList();
    await filePage.fillInExistingFileId(fileFromList);
    await filePage.clickOnLinkFileButton();
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    const isFileCardVisible = await filePage.isFileCardVisible(fileFromList);
    expect(isFileCardVisible).toBe(true);
  });

  test('Verify account create tx is displayed in history page', async () => {
    const txDescription = 'test account create tx description';
    const { newTransactionId } = await transactionPage.createNewAccount({
      description: txDescription,
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Create Transaction',
      txDescription,
    );
  });

  test('Verify transaction details are displayed for account tx ', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount({
      description: 'testDescription',
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Create Transaction',
    );
    const getAccountDetailsKey = await detailsPage.getAccountDetailsKey();
    expect(getAccountDetailsKey).toBeTruthy();

    const getAccountDetailsStaking = await detailsPage.getAccountDetailsStaking();
    expect(getAccountDetailsStaking).toBe('None');

    const getAccountDetailsAcceptRewards = await detailsPage.getAccountDetailsAcceptRewards();
    expect(getAccountDetailsAcceptRewards).toBe('Yes');

    const getAccountDetailsReceiverSigRequired =
      await detailsPage.getAccountDetailsReceiverSigRequired();
    expect(getAccountDetailsReceiverSigRequired).toBe('No');

    const getAccountDetailsInitialBalance = await detailsPage.getAccountDetailsInitBalance();
    expect(getAccountDetailsInitialBalance).toBe('0 ℏ');

    const getTransactionDescription = await detailsPage.getTransactionDescription();
    expect(getTransactionDescription).toBe('testDescription');
  });

  test('Verify transaction details are displayed for account update tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Update Transaction',
    );
    const getTransactionMemo = await detailsPage.getTransactionDetailsMemo();
    expect(getTransactionMemo).toBe('Transaction memo update');

    const getAccountId = await detailsPage.getAccountUpdateDetailsId();
    expect(getAccountId).toContain(accountFromList);

    const getAccountMemoDetails = await detailsPage.getAccountDetailsMemo();
    expect(getAccountMemoDetails).toBe(updatedMemoText);
  });

  test('Verify account update tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo again';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Update Transaction',
    );
  });

  test('Verify account delete tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Delete Transaction',
    );
  });

  test('Verify transaction details are displayed for account delete tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Delete Transaction',
    );
    const getDeletedAccountId = await detailsPage.getDeletedAccountId();
    expect(getDeletedAccountId).toContain(accountFromList);

    const getTransferAccountId = await detailsPage.getAccountDeleteDetailsTransferId();
    expect(getTransferAccountId).toBeTruthy();
  });

  test('Verify transfer tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Transfer Transaction');
  });

  test('Verify transaction details are displayed for transfer tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Transfer Transaction',
    );
    const transferDetailsFromAccount = await detailsPage.getTransferDetailsFromAccount();
    expect(transferDetailsFromAccount).toBeTruthy();

    const transferDetailsFromAmount = await detailsPage.getTransferDetailsFromAmount();
    expect(transferDetailsFromAmount).toContain('-' + amountToBeTransferred + ' ℏ');

    const transferDetailsToAccount = await detailsPage.getTransferDetailsToAccount();
    expect(transferDetailsToAccount).toContain(accountFromList);

    const transferDetailsToAmount = await detailsPage.getTransferDetailsToAmount();
    expect(transferDetailsToAmount).toContain(amountToBeTransferred + ' ℏ');
  });

  test('Verify approve allowance tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Allowance Approve Transaction',
    );
  });

  test('Verify transaction details are displayed for approve allowance tx ', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      newTransactionId ?? '',
      'Account Allowance Approve Transaction',
    );
    const allowanceOwnerAccount = await detailsPage.getAllowanceDetailsOwnerAccount();
    expect(allowanceOwnerAccount).toBeTruthy();

    const allowanceSpenderAccount = await detailsPage.getAllowanceDetailsSpenderAccount();
    expect(allowanceSpenderAccount).toContain(accountFromList);

    const allowanceAmount = await detailsPage.getAllowanceDetailsAmount();
    expect(allowanceAmount).toContain(amountToBeApproved + ' ℏ');
  });

  test('Verify file create tx is displayed in history page', async () => {
    const { transactionId } = await transactionPage.createFile('test');
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(transactionId ?? '', 'File Create Transaction');
  });

  test('Verify transaction details are displayed for file create tx ', async () => {
    const { transactionId } = await transactionPage.createFile('test');
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      transactionId ?? '',
      'File Create Transaction',
    );
    const isKeyButtonVisible = await detailsPage.isSeeKeyDetailsButtonVisible();
    expect(isKeyButtonVisible).toBe(true);

    const fileDetailsExpirationTime = await detailsPage.getFileDetailsExpirationTime();
    expect(fileDetailsExpirationTime).toBeTruthy();

    const isViewContentButtonVisible = await detailsPage.isViewContentsButtonVisible();
    expect(isViewContentButtonVisible).toBe(true);
  });

  test('Verify file update tx is displayed in history page', async () => {
    const newText = 'Lorem Ipsum';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.updateFile(fileId ?? '', newText);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(transactionId ?? '', 'File Update Transaction');
  });

  test('Verify transaction details are displayed for file update tx ', async () => {
    const newText = 'New text';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.updateFile(fileId ?? '', newText);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      transactionId ?? '',
      'File Update Transaction',
    );
    const fileIdFromDetailsPage = await detailsPage.getFileDetailsFileId();
    expect(fileId).toBe(fileIdFromDetailsPage);

    const isViewContentButtonVisible = await detailsPage.isViewContentsButtonVisible();
    expect(isViewContentButtonVisible).toBe(true);
  });

  test('Verify file append tx is displayed in history page', async () => {
    const newText = ' extra text to append';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.appendFile(fileId ?? '', newText);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(transactionId ?? '', 'File Append Transaction');
  });

  // This test is failing in CI environment due to bug in the SDK
  test('Verify transaction details are displayed for file append tx ', async () => {
    const newText = ' extra text to append';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.appendFile(fileId ?? '', newText);
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(
      transactionId ?? '',
      'File Append Transaction',
    );
    const fileIdFromDetailsPage = await detailsPage.getFileDetailsFileId();
    expect(fileId).toBe(fileIdFromDetailsPage);

    const isViewContentButtonVisible = await detailsPage.isViewContentsButtonVisible();
    expect(isViewContentButtonVisible).toBe(true);
  });
});
