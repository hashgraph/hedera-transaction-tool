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

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage;

test.describe('Transaction tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
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
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password);

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const createdTimestamp = accountDetails.accounts[0]?.created_timestamp;
    expect(createdTimestamp).toBeTruthy();
  });

  test('Verify user can create account with memo', async () => {
    const memoText = 'test memo';

    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      memo: memoText,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const memoFromAPI = accountDetails.accounts[0]?.memo;
    expect(memoFromAPI).toBe(memoText);
  });

  test('Verify user can create account with receiver sig required', async () => {
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      isReceiverSigRequired: true,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const isReceiverSigRequired = accountDetails.accounts[0]?.receiver_sig_required;
    expect(isReceiverSigRequired).toBe(true);
  });

  test('Verify user can create account with initial funds', async () => {
    const initialHbarFunds = '1';

    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      initialFunds: initialHbarFunds,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const balanceFromAPI = accountDetails.accounts[0]?.balance?.balance;
    expect(balanceFromAPI).toBe(initialHbarFunds * 100000000);
  });

  test('Verify user can create account with max account associations', async () => {
    const maxAutoAssociations = 10;

    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      maxAutoAssociations,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const maxAutoAssociationsFromAPI = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssociationsFromAPI).toBe(maxAutoAssociations);
  });

  test('Verify transaction is stored in the local database for account create tx', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount(globalCredentials.password);

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      newTransactionId,
      'Account Create Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is stored in the local database for account create tx', async () => {
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password);
    await transactionPage.clickOnAccountsMenuButton();

    const isTxExistingInDb = await transactionPage.verifyAccountExists(newAccountId);

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify user can execute Account Create tx with complex key', async () => {
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password, {
      isComplex: true,
    });
    const allGeneratedKeys = transactionPage.getAllGeneratedPublicKeys();

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const protoBufEncodedBytes = accountDetails.accounts[0]?.key?.key;
    const decodedKeys = await transactionPage.decodeByteCode(protoBufEncodedBytes);
    const keysMatch = await transactionPage.keysMatch(decodedKeys, allGeneratedKeys);
    expect(keysMatch).toBe(true);
  });

  test('Verify account is displayed in the account card section', async () => {
    const { newAccountId } = await transactionPage.createNewAccount(globalCredentials.password);

    await transactionPage.clickOnAccountsMenuButton();
    const isAccountVisible = await transactionPage.isAccountCardVisible(newAccountId);

    expect(isAccountVisible).toBe(true);
  });

  test('Verify user can execute account delete tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const transactionId = await transactionPage.deleteAccount(
      accountFromList,
      globalCredentials.password,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId);
    const transactionType = transactionDetails.transactions[0]?.name;
    const deletedAccount = transactionDetails.transactions[0]?.entity_id;
    const result = transactionDetails.transactions[0]?.result;

    expect(transactionType).toBe('CRYPTODELETE');
    expect(deletedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');
  });

  test('Verify account is deleted from the db after account delete tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList, globalCredentials.password);

    const isTxExistingInDb = await transactionPage.verifyAccountExists(accountFromList);
    expect(isTxExistingInDb).toBe(false);
  });

  test('Verify account id is removed from the account cards after account delete tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList, globalCredentials.password);

    const isAccountVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isAccountVisible).toBe(false);
  });

  test('Verify that account is updated after we execute an account update tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const transactionId = await transactionPage.updateAccount(
      accountFromList,
      globalCredentials.password,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId);

    const transactionType = transactionDetails.transactions[0]?.name;
    const updatedAccount = transactionDetails.transactions[0]?.entity_id;
    const result = transactionDetails.transactions[0]?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');

    const accountDetails = await transactionPage.mirrorGetAccountResponse(accountFromList);

    const memoFromResponse = accountDetails.accounts[0]?.memo;
    expect(memoFromResponse).toBe(updatedMemoText);

    const maxAutoAssocFromResponse = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssocFromResponse.toString()).toBe(maxAutoAssociationsNumber);

    const acceptStakingRewardsFromResponse = accountDetails.accounts[0]?.decline_reward;
    expect(acceptStakingRewardsFromResponse).toBe(true);
  });

  test('Verify user can execute transfer tokens tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const transactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
      globalCredentials.password,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId);

    const transactionType = transactionDetails.transactions[0]?.name;
    const allTransfer = transactionDetails.transactions[0]?.transfers;
    const amount = allTransfer.find(acc => acc.account === accountFromList)?.amount;
    const result = transactionDetails.transactions[0]?.result;
    expect(transactionType).toBe('CRYPTOTRANSFER');
    expect(amount).toBe(amountToBeTransferred * 100000000);
    expect(result).toBe('SUCCESS');
  });

  test('Verify transfer tokens tx fail with insufficient payer balance', async () => {
    test.setTimeout(1200000);
    await transactionPage.ensureAccountExists(globalCredentials.password);
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '10000000';
    await loginPage.waitForToastToDisappear();
    await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
      globalCredentials.password,
      { isSupposedToFail: true },
    );

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toContain('failed precheck with status INSUFFICIENT_PAYER_BALANCE');
  });

  test('Verify user can add the rest of remaining hbars to receiver accounts', async () => {
    const amountToBeTransferred = 10;
    const amountLeftForRestAccounts = 9;
    await transactionPage.ensureAccountExists(globalCredentials.password);
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
    const [firstReceiverAmount, secondReceiverAmount] =
      await transactionPage.getHbarAmountValueForTwoAccounts();
    expect(firstReceiverAmount).toContain(
      (amountToBeTransferred - amountLeftForRestAccounts).toString(),
    );
    expect(secondReceiverAmount).toContain(amountLeftForRestAccounts.toString());
  });

  test('Verify sign button is disabled when receiver amount is higher than payer amount when doing transfer tx', async () => {
    await transactionPage.ensureAccountExists(globalCredentials.password);
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
});
