const { test } = require('@playwright/test');
const {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');
const AccountPage = require('../pages/AccountPage');
const FilePage = require('../pages/FilePage');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage, accountPage, filePage;

test.describe('Workflow tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    accountPage = new AccountPage(window);
    filePage = new FilePage(window);
    await loginPage.logout();
    await resetAppState(window);
    registrationPage = new RegistrationPage(window);

    // Ensure transactionPage generatedAccounts is empty
    transactionPage.generatedAccounts = [];

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window, globalCredentials.password);
  });

  test.afterAll(async () => {
    // Ensure transactionPage generatedAccounts is empty
    transactionPage.generatedAccounts = [];
    await transactionPage.closeCompletedTransaction();
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await loginPage.logout();
    await resetAppState(window);

    await closeApp(app);
  });

  test.beforeEach(async () => {
    await transactionPage.closeCompletedTransaction();
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
  });

  test('Verify account card is visible with valid information', async () => {
    const initialHbarFunds = '1';
    const receiverSigRequired = true;
    const memoText = 'test memo';
    const maxAutoAssociations = '23';

    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      initialFunds: initialHbarFunds,
      isReceiverSigRequired: receiverSigRequired,
      memo: memoText,
      maxAutoAssociations: maxAutoAssociations,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
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

    const evmAddress = (await accountPage.getEvmAddressText()).trim();
    expect(evmAddress).toBe(evmAddressFromMirrorNode);

    const balance = (await accountPage.getBalanceText()).trim();
    expect(balance).toContain(initialHbarFunds);

    const key = (await accountPage.getKeyText()).trim();
    expect(key).toBe(keyAddressFromMirrorNode);

    const keyType = (await accountPage.getKeyTypeText()).trim();
    expect(normalizedKeyTypeFromMirrorNode).toContain(keyType);

    const receiverSigRequiredText = (await accountPage.getReceiverSigRequiredText()).trim();
    expect(receiverSigRequiredText).toBe('Yes');

    const memo = (await accountPage.getMemoText()).trim();
    expect(memo).toBe(memoText);

    const maxAutoAssociationsText = (await accountPage.getMaxAutoAssocText()).trim();
    expect(maxAutoAssociationsText).toBe(maxAutoAssociationsFromMirrorNode.toString());

    const ethereumNonceText = (await accountPage.getEthereumNonceText()).trim();
    expect(ethereumNonceText).toBe(ethereumNonceFromMirrorNode.toString());

    const createdAtText = (await accountPage.getCreatedAtText()).trim();
    expect(createdAtText).toBeTruthy();

    const expiresAtText = (await accountPage.getExpiresAtText()).trim();
    expect(expiresAtText).toBeTruthy();

    const autoRenewPeriodText = (await accountPage.getAutoRenewPeriodText()).trim();
    expect(autoRenewPeriodText).toContain(autoRenewPeriodFromMirrorNode.toString());

    const stakedToText = (await accountPage.getStakedToText()).trim();
    expect(stakedToText).toBe('None');

    const pendingRewardText = (await accountPage.getPendingRewardText()).trim();
    expect(pendingRewardText).toBe('0 tℏ');

    const rewardsText = (await accountPage.getRewardsText()).trim();
    expect(rewardsText).toBe('Accepted');
  });

  test('Verify clicking on "Create New" button navigates the user on create account tx page', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnCreateNewLink();

    const isSignAndSubmitButtonVisible =
      await transactionPage.isSignAndSubmitCreateAccountButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);
  });

  test('Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnUpdateInNetworkLink();

    const isSignAndSubmitButtonVisible =
      await transactionPage.isSignAndSubmitUpdateAccountButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);

    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInUpdatePage();
    expect(isAccountIdPrefilled).toBe(accountFromList);
  });

  test('Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnDeleteFromNetworkLink();

    const isTransferAccountIdVisible = await transactionPage.isTransferAccountIdVisible();
    expect(isTransferAccountIdVisible).toBe(true);

    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInDeletePage();
    expect(isAccountIdPrefilled).toBe(accountFromList);
  });

  test('Verify user can unlink accounts', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.clickOnTransactionsMenuButton();
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password);
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAccountCheckbox(newAccountId);

    await accountPage.clickOnRemoveButton();
    await accountPage.unlinkAccounts();
    await accountPage.addAccountToUnliked(newAccountId);
    await accountPage.addAccountToUnliked(accountFromList);

    const isFirstAccountCardVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isFirstAccountCardVisible).toBe(false);

    const isSecondAccountCardVisible = await transactionPage.isAccountCardVisible(newAccountId);
    expect(isSecondAccountCardVisible).toBe(false);
  });

  test('Verify user can add an existing account', async () => {
    await accountPage.ensureAccountExistsAndUnlinked(globalCredentials.password);
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
    await transactionPage.ensureFileExists('test', globalCredentials.password);
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
    await transactionPage.ensureFileExists('test', globalCredentials.password);
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnUpdateFileButton();
    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromUpdatePage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Update File Transaction');
  });

  test('Verify file card append flow leads to append page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test', globalCredentials.password);
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnAppendFileButton();
    const fileIdFromAppendPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromAppendPage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Append File Transaction');
  });

  test('Verify file card read flow leads to read page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test', globalCredentials.password);
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
    expect(transactionHeaderText).toBe('Create File Transaction');
  });

  test('Verify clicking on "Add new" and "Update" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnUpdateFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Update File Transaction');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify clicking on "Add new" and "Append" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnAppendFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Append File Transaction');

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
    await transactionPage.ensureFileExists('test', globalCredentials.password);
    await filePage.clickOnFilesMenuButton();
    const fileFromPage = await filePage.getFirstFileIdFromPage();
    const { fileId } = await transactionPage.createFile('test', globalCredentials.password);
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    await filePage.clickOnFileCheckbox(fileId);
    await filePage.clickOnRemoveFileCardButton();
    await filePage.clickOnConfirmUnlinkFileButton();

    await filePage.addFileToUnliked(fileFromPage);
    await filePage.addFileToUnliked(fileId);
    await loginPage.waitForToastToDisappear();

    const isFileCardVisible = await filePage.isFileCardVisible(fileId);
    expect(isFileCardVisible).toBe(false);

    const isSecondFileCardVisible = await filePage.isFileCardVisible(fileFromPage);
    expect(isSecondFileCardVisible).toBe(false);
  });

  test('Verify user can add an existing file to files card', async () => {
    test.setTimeout(1200000);
    await filePage.ensureFileExistsAndUnlinked(globalCredentials.password);
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
});
