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
import { Transaction } from '../../front-end/src/shared/interfaces/index.js';

let app: ElectronApplication;
let window: Page;
const globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;

test.describe('Transaction tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
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

  test('Verify user can execute Account Create tx with complex key', async () => {
    const { newAccountId } = await transactionPage.createNewAccount({ isComplex: true });
    const allGeneratedKeys = transactionPage.getAllGeneratedPublicKeys();

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const protoBufEncodedBytes = accountDetails.accounts[0]?.key?.key;
    const decodedKeys = await transactionPage.decodeByteCode(protoBufEncodedBytes);
    const keysMatch = await transactionPage.keysMatch(decodedKeys, allGeneratedKeys);
    expect(keysMatch).toBe(true);
  });

  test('Verify user can execute account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const transactionId = await transactionPage.deleteAccount(accountFromList);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId!);
    const transactionType = transactionDetails?.name;
    const deletedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;

    expect(transactionType).toBe('CRYPTODELETE');
    expect(deletedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');
  });

  test('Verify that all elements on account create page are correct', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const allElementsAreVisible = await transactionPage.verifyAccountCreateTransactionElements();

    expect(allElementsAreVisible).toBe(true);
  });

  test('Verify confirm transaction modal is displayed with valid information for Account Create tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    await transactionPage.clickOnSignAndSubmitButton();
    const confirmTransactionIsDisplayedAndCorrect =
      await transactionPage.verifyConfirmTransactionInformation('Account Create Transaction');
    await transactionPage.clickOnCancelTransaction();

    expect(confirmTransactionIsDisplayedAndCorrect).toBe(true);
  });

  test('Verify user can execute create account transaction with single key', async () => {
    const { newAccountId } = await transactionPage.createNewAccount();

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const createdTimestamp = accountDetails.accounts[0]?.created_timestamp;
    expect(createdTimestamp).toBeTruthy();
  });

  test('Verify user can create account with memo', async () => {
    const memoText = 'test memo';

    const { newAccountId } = await transactionPage.createNewAccount({ memo: memoText });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const memoFromAPI = accountDetails.accounts[0]?.memo;
    expect(memoFromAPI).toBe(memoText);
  });

  test('Verify user can create account with receiver sig required', async () => {
    const { newAccountId } = await transactionPage.createNewAccount({
      isReceiverSigRequired: true,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const isReceiverSigRequired = accountDetails.accounts[0]?.receiver_sig_required;
    expect(isReceiverSigRequired).toBe(true);
  });

  test('Verify user can create account with initial funds', async () => {
    const initialHbarFunds = 1;

    const { newAccountId } = await transactionPage.createNewAccount({
      initialFunds: initialHbarFunds.toString(),
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const balanceFromAPI = accountDetails.accounts[0]?.balance?.balance;
    expect(balanceFromAPI).toBe(initialHbarFunds * 100000000);
  });

  test('Verify user can create account with max account associations', async () => {
    const maxAutoAssociations = 10;

    const { newAccountId } = await transactionPage.createNewAccount({ maxAutoAssociations });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const maxAutoAssociationsFromAPI = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssociationsFromAPI).toBe(maxAutoAssociations);
  });

  test('Verify transaction is stored in the local database for account create tx', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount();

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      newTransactionId ?? '',
      'Account Create Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is stored in the local database for account create tx', async () => {
    const { newAccountId } = await transactionPage.createNewAccount();
    await transactionPage.clickOnAccountsMenuButton();

    const isTxExistingInDb = await transactionPage.verifyAccountExists(newAccountId ?? '');

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is displayed in the account card section', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();

    await transactionPage.clickOnAccountsMenuButton();
    const isAccountVisible = await transactionPage.isAccountCardVisible(accountFromList);

    expect(isAccountVisible).toBe(true);
  });

  test('Verify account is deleted from the db after account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);

    const isTxExistingInDb = await transactionPage.verifyAccountExists(accountFromList);
    expect(isTxExistingInDb).toBe(false);
  });

  test('Verify account id is removed from the account cards after account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnAccountsMenuButton();

    const isAccountHidden = await transactionPage.isAccountCardHidden(accountFromList);
    expect(isAccountHidden).toBe(true);
  });

  test('Verify that account is updated after we execute an account update tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const transactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');

    const accountDetails = await transactionPage.mirrorGetAccountResponse(accountFromList);

    const memoFromResponse = accountDetails.accounts[0]?.memo;
    expect(memoFromResponse).toBe(updatedMemoText);

    const maxAutoAssocFromResponse = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssocFromResponse.toString()).toBe(maxAutoAssociationsNumber);
  });

  test('Verify that system account can be updated without account key using a superUser as the fee payer', async () => {
    await setupEnvironmentForTransactions(window, process.env.OPERATOR_KEY);
    const newPublicKey = await transactionPage.generateRandomPublicKey();
    const transactionId = await transactionPage.updateAccountKey('0.0.100', newPublicKey, '0.0.2');

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe('0.0.100');
    expect(result).toBe('SUCCESS');

    // const accountDetails = await transactionPage.mirrorGetAccountResponse('0.0.100');
    // const key = accountDetails.accounts[0]?.key?.key;
  });

  test('Verify user can execute transfer tokens tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = 1;
    const transactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred.toString(),
    );

    const transactionDetails: Transaction = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const allTransfer = transactionDetails?.transfers;
    const amount = allTransfer.find(acc => acc.account === accountFromList)?.amount;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOTRANSFER');
    expect(amount).toBe(amountToBeTransferred * 100000000);
    expect(result).toBe('SUCCESS');
  });

  test('Verify user can add the rest of remaining hbars to receiver accounts', async () => {
    const amountToBeTransferred = 10;
    const amountLeftForRestAccounts = 9;
    await transactionPage.ensureAccountExists();
    const receiverAccount = await transactionPage.getFirstAccountFromList();
    await loginPage.waitForToastToDisappear();

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnTransferTokensTransaction();
    await transactionPage.fillInTransferFromAccountId();
    await transactionPage.fillInTransferAmountFromAccount(amountToBeTransferred.toString());
    await transactionPage.fillInTransferToAccountId(receiverAccount);
    await transactionPage.clickOnAddTransferFromButton();
    await transactionPage.fillInTransferAmountToAccount(
      (amountToBeTransferred - amountLeftForRestAccounts).toString(),
    );
    await transactionPage.clickOnAddTransferToButton();

    await transactionPage.fillInTransferToAccountId(await transactionPage.getPayerAccountId());
    await transactionPage.clickOnAddRestButton();

    // Get HBAR amounts for the two accounts and verify rest is added up
    const amounts = await transactionPage.getHbarAmountValueForTwoAccounts()
    const firstReceiverAmount = amounts?.split(',')[0] ?? ''
    const secondReceiverAmount = amounts?.split(',')[1] ?? ''
    expect(firstReceiverAmount).toContain(
      (amountToBeTransferred - amountLeftForRestAccounts).toString(),
    );
    expect(secondReceiverAmount).toContain(amountLeftForRestAccounts.toString());
  });

  test('Verify sign button is disabled when receiver amount is higher than payer amount when doing transfer tx', async () => {
    await transactionPage.ensureAccountExists();
    const receiverAccount = await transactionPage.getFirstAccountFromList();
    await loginPage.waitForToastToDisappear();

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnTransferTokensTransaction();
    await transactionPage.fillInTransferFromAccountId();
    await transactionPage.fillInTransferAmountFromAccount('10');
    await transactionPage.fillInTransferToAccountId(receiverAccount);
    await transactionPage.clickOnAddTransferFromButton();
    await transactionPage.fillInTransferAmountToAccount('200');
    await transactionPage.clickOnAddTransferToButton();

    const isButtonEnabled = await transactionPage.isSignAndSubmitButtonEnabled();
    expect(isButtonEnabled).toBe(false);
  });

  test('Verify user can execute approve allowance tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const transactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOAPPROVEALLOWANCE');
    expect(result).toBe('SUCCESS');

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      transactionId ?? '',
      'Account Allowance Approve Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify all elements are present on file create tx page', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnFileCreateTransaction();

    const isAllElementsVisible = await transactionPage.verifyFileCreateTransactionElements();
    expect(isAllElementsVisible).toBe(true);
  });

  test('Verify user can execute file create tx', async () => {
    const { transactionId } = await transactionPage.createFile('test');

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILECREATE');
    expect(result).toBe('SUCCESS');
  });

  test('Verify file is stored in the db after file create tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();

    const isExistingInDb = await transactionPage.verifyFileExists(fileId?? '');

    expect(isExistingInDb).toBe(true);
  });

  test('Verify user can execute file read tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const textFromCache = await transactionPage.getTextFromCache(fileId?? '');

    const readContent = await transactionPage.readFile(fileId?? '');

    expect(readContent).toBe(textFromCache);
  });

  test('Verify user can execute file update tx', async () => {
    const newText = 'Lorem Ipsum';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.updateFile(fileId?? '', newText);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId?? '');
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILEUPDATE');
    expect(result).toBe('SUCCESS');

    //Verify file content is updated
    const readContent = await transactionPage.readFile(fileId?? '');
    const textFromCache = await transactionPage.getTextFromCache(fileId?? '');
    expect(readContent).toBe(textFromCache);
  });

  test('Verify user can execute file append tx', async () => {
    const newText = ' extra text to append';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.appendFile(fileId?? '', newText);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId?? '');
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILEAPPEND');
    expect(result).toBe('SUCCESS');

    //Verify file content is appended
    const readContent = await transactionPage.readFile(fileId?? '');
    const textFromCache = await transactionPage.getTextFromCache(fileId?? '');
    expect(readContent).toBe(textFromCache);
  });

  test('Verify user can save draft and is visible in the draft page', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.fillInDescription('test create tx description');
    await transactionPage.saveDraft();

    const draftDate = await transactionPage.getFirstDraftDate();
    expect(draftDate).toBeTruthy();

    const draftType = await transactionPage.getFirstDraftType();
    expect(draftType).toBe('Account Create');

    const description = await transactionPage.getFirstDraftDescription();
    expect(description).toBe('test create tx description');

    const isTemplateCheckboxVisible =
      await transactionPage.getFirstDraftIsTemplateCheckboxVisible();
    expect(isTemplateCheckboxVisible).toBe(true);

    const isDeleteButtonVisible = await transactionPage.isFirstDraftDeleteButtonVisible();
    expect(isDeleteButtonVisible).toBe(true);

    const isContinueButtonVisible = await transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(true);

    await transactionPage.deleteFirstDraft();
  });

  test('Verify user can delete a draft transaction', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.saveDraft();

    await transactionPage.deleteFirstDraft();

    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is no longer visible after we execute the tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();
    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();
    await transactionPage.createNewAccount({}, true);
    await transactionPage.clickOnTransactionsMenuButton();

    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is visible after we execute the tx and we have template checkbox selected', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();
    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftIsTemplateCheckbox();
    await transactionPage.clickOnFirstDraftContinueButton();
    await transactionPage.createNewAccount({}, true);
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.navigateToDrafts();

    const isContinueButtonVisible = await transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(true);

    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account create tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const initialBalance = '10';
    const maxAutoAssociations = '10';
    const accountMemo = 'test acc memo';
    const testNickname = 'testNickname';
    await transactionPage.fillInNickname(testNickname);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.clickOnReceiverSigRequiredSwitch();
    await transactionPage.fillInInitialFunds(initialBalance);
    await transactionPage.fillInMaxAccountAssociations(maxAutoAssociations);
    await transactionPage.fillInMemo(accountMemo);

    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(true);

    const isReceiverSigRequiredSwitchOn =
      await transactionPage.isReceiverSigRequiredSwitchToggledOn();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const initialFundsFromField = await transactionPage.getInitialFundsValue();
    expect(initialFundsFromField).toBe(initialBalance);

    const maxAutoAssociationsFromField = await transactionPage.getFilledMaxAccountAssociations();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await transactionPage.getMemoText();
    expect(accountMemoFromField).toBe(accountMemo);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account update tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const accountIdToBeUpdated = '0.0.12345';
    const accountMemo = 'test acc memo';
    const maxAutoAssociations = '10';
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInUpdateAccountIdNormally(accountIdToBeUpdated);
    await transactionPage.clickOnAcceptStakingRewardsSwitch();
    await transactionPage.turnReceiverSigSwitchOn();
    await transactionPage.fillInMaxAutoAssociations(maxAutoAssociations);
    await transactionPage.fillInMemoUpdate(accountMemo);

    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(false);

    const isReceiverSigRequiredSwitchOn =
      await transactionPage.isReceiverSigRequiredSwitchToggledOnForUpdatePage();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const maxAutoAssociationsFromField =
      await transactionPage.getFilledMaxAutoAssociationsOnUpdatePage();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await transactionPage.getMemoTextOnUpdatePage();
    expect(accountMemoFromField).toBe(accountMemo);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account delete tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnDeleteAccountTransaction();

    const transferAccountId = await transactionPage.fillInTransferAccountId();
    const transactionMemoText = 'test memo';
    const accountIdToBeDeleted = '0.0.1234';
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInDeleteAccountIdNormally(accountIdToBeDeleted);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const deletedIdFromField = await transactionPage.getPrefilledAccountIdInDeletePage();
    expect(deletedIdFromField.startsWith(accountIdToBeDeleted)).toBe(true);

    const transferIdFromField = await transactionPage.getPrefilledTransferIdAccountInDeletePage();
    expect(transferIdFromField).toContain(transferAccountId);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for approve allowance tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnApproveAllowanceTransaction();

    const transactionMemoText = 'test memo';
    const amount = '10';
    const spenderAccountId = '0.0.1234';
    await transactionPage.fillInTransactionMemoForApprovePage(transactionMemoText);
    const ownerId = await transactionPage.fillInAllowanceOwnerAccount();
    await transactionPage.fillInAllowanceAmount(amount);
    await transactionPage.fillInSpenderAccountIdNormally(spenderAccountId);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoFromApprovePage();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const allowanceOwnerAccountIdFromPage = await transactionPage.getAllowanceOwnerAccountId();
    expect(allowanceOwnerAccountIdFromPage).toContain(ownerId);

    const allowanceAmountFromField = await transactionPage.getAllowanceAmount();
    expect(allowanceAmountFromField).toBe(amount);

    const spenderAccountIdFromField = await transactionPage.getSpenderAccountId();
    expect(spenderAccountIdFromField).toContain(spenderAccountId);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for create file tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnFileCreateTransaction();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';
    // const fileContent = 'test file content';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileMemo(fileMemoText);
    // await transactionPage.fillInFileContent(fileContent);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for update file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnUpdateFileSublink();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForUpdate(fileId?? '');
    await transactionPage.fillInFileMemo(fileMemoText);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromPage);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for append file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnAppendFileSublink();

    const transactionMemoText = 'test memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForAppend(fileId?? '');

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromPage);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });
});
