const BasePage = require('./BasePage');
const { getAccountDetails, getTransactionDetails } = require('../utils/mirrorNodeAPI');
const { queryDatabase } = require('../utils/databaseUtil');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');

class TransactionPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.generatedPublicKeys = []; // Store generated public keys
    this.generatedAccounts = []; // Store generated accounts from create account transaction
  }

  /* Selectors */

  //Inputs
  initialBalanceInputSelector = 'input-initial-balance-amount';
  maxAutoAssociationsInputSelector = 'input-max-auto-associations';
  accountMemoInputSelector = 'input-account-memo';
  nicknameInputSelector = 'input-nickname';
  passwordSignTransactionInputSelector = 'input-password-transaction';
  publicKeyComplexInputSelector = 'input-complex-public-key';
  deletedAccountInputSelector = 'input-delete-account-id';
  transferAccountInputSelector = 'input-transfer-account-id';
  updateAccountInputSelector = 'input-account-id-for-update';
  maxAutoAssociationsUpdateInputSelector = 'input-max-auto-token-associations';
  memoUpdateInputSelector = 'input-memo-update';
  transferFromAccountIdInputSelector = 'input-transfer-from-account';
  transferAmountFromAccountInputSelector = 'input-transfer-from-amount';
  transferToAccountIdInputSelector = 'input-transfer-to-account';
  transferAmountToAccountInputSelector = 'input-transfer-to-amount';
  allowanceOwnerAccountSelector = 'input-owner-account';
  allowanceSpenderAccountSelector = 'input-spender-account';
  allowanceAmountSelector = 'input-allowance-amount';

  //Buttons
  transactionsMenuButtonSelector = 'button-menu-transactions';
  accountsMenuButtonSelector = 'button-menu-accounts';
  createNewTransactionButtonSelector = 'button-create-new';
  createAccountSublinkSelector = 'menu-sublink-0';
  updateAccountSublinkSelector = 'menu-sublink-1';
  transferTokensSublinkSelector = 'menu-sublink-2';
  deleteAccountSublinkSelector = 'menu-sublink-3';
  allowanceSublinkSelector = 'menu-sublink-4';
  saveDraftButtonSelector = 'button-save-draft';
  signAndSubmitButtonSelector = 'button-sign-and-submit';
  signAndSubmitDeleteButtonSelector = 'button-sign-and-submit-delete';
  signAndSubmitUpdateButtonSelector = 'button-sign-and-submit-update';
  payerDropdownSelector = 'dropdown-payer';
  singleTabSelector = 'tab-single';
  complexTabSelector = 'tab-complex';
  receiverSigRequiredSwitchSelector = 'switch-receiver-sig-required';
  acceptStakingRewardsSwitchSelector = 'switch-accept-staking-rewards';
  discardModalDraftButtonSelector = 'button-discard-draft-modal';
  buttonSignTransactionSelector = 'button-sign-transaction';
  buttonCancelTransactionSelector = 'button-cancel-transaction';
  passwordContinueButtonSelector = 'button-password-continue';
  closeCompletedTxButtonSelector = 'button-close-completed-tx';
  addComplexButtonIndex = 'button-complex-key-add-element-';
  selectThresholdNumberIndex = 'button-complex-key-add-element-threshold-';
  addPublicKeyButtonIndex = 'button-complex-key-add-element-public-key-';
  insertPublicKeyButtonSelector = 'button-insert-public-key';
  doneComplexKeyButtonSelector = 'button-complex-key-done';
  addNewAccountButtonSelector = 'button-add-new-account';
  addTransferFromButtonSelector = 'button-add-transfer-from';
  addRestButtonSelector = 'button-transfer-to-rest';
  addTransferToButtonSelector = 'button-add-transfer-to';
  signAndSubmitTransferSelector = 'button-sign-and-submit-transfer';
  signAndSubmitAllowanceSelector = 'button-sign-and-submit-allowance';

  //Other
  successCheckMarkIconSelector = 'icon-success-checkmark';
  modalTransactionSuccessSelector = 'modal-transaction-success';
  confirmTransactionModalSelector = 'modal-confirm-transaction';
  spanCreateNewComplexKeyButtonSelector = 'span-create-new-complex-key';
  updateAccountIdFetchedDivSelector = 'div-account-info-fetched';

  //Messages
  textTypeTransactionSelector = 'p-type-transaction';
  textTransactionIdSelector = 'p-transaction-id';
  linkTransactionIdSelector = 'a-transaction-id';
  textMaxTxFeeSelector = 'p-max-tx-fee';
  newlyCreatedTransactionIdSelector = 'a-transaction-id';
  newlyCreatedAccountIdSelector = 'p-new-crated-account-id';
  accountIdPrefixSelector = 'p-account-id-';
  toastMessageSelector = '.v-toast__text';
  hbarAmountValueSelector = 'p-hbar-amount';

  // Method to close the 'Save Draft' modal if it appears
  async closeDraftModal() {
    // Wait for the button to be visible with a timeout
    const modalButton = this.window.getByTestId(this.discardModalDraftButtonSelector);
    await modalButton.waitFor({ state: 'visible', timeout: 500 }).catch(e => {});

    // If the modal is visible, then click the button to close the modal
    if (await modalButton.isVisible()) {
      await modalButton.click();
    }
  }

  // Combined method to verify all elements on Create transaction page
  async verifyAccountCreateTransactionElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.saveDraftButtonSelector),
      this.isElementVisible(this.singleTabSelector),
      this.isElementVisible(this.complexTabSelector),
      this.isElementVisible(this.signAndSubmitButtonSelector),
      this.isElementVisible(this.payerDropdownSelector),
      this.isElementVisible(this.initialBalanceInputSelector),
      this.isElementVisible(this.maxAutoAssociationsInputSelector),
      this.isElementVisible(this.accountMemoInputSelector),
      this.isElementVisible(this.nicknameInputSelector),
    ]);

    // Return true if all checks pass
    return checks.every(isTrue => isTrue);
  }

  async verifyConfirmTransactionInformation(typeTransaction) {
    await this.window.waitForSelector(
      '[data-testid="modal-confirm-transaction"][style*="display: block"]',
      { state: 'visible', timeout: 10000 },
    );
    const regex = /^\d+\.\d+\.\d+@\d+\.\d+$/;
    const transactionId = await this.getTextByTestId(this.textTransactionIdSelector);
    const txType = await this.getTextByTestId(this.textTypeTransactionSelector);
    const maxTxFee = await this.getTextByTestId(this.textMaxTxFeeSelector);
    const isSignButtonVisible = await this.isElementVisible(this.buttonSignTransactionSelector);

    const checks = [
      regex.test(transactionId),
      txType === typeTransaction,
      maxTxFee.length > 0,
      isSignButtonVisible,
    ];

    return checks.every(isTrue => isTrue);
  }

  async mirrorGetAccountResponse(accountId) {
    const accountDetails = await getAccountDetails(accountId);
    console.log('Account Details:', accountDetails);
    return accountDetails;
  }

  async mirrorGetTransactionResponse(transactionId) {
    const transactionDetails = await getTransactionDetails(transactionId);
    if (transactionDetails.transactions.length > 0) {
      console.log('Transaction Details:', transactionDetails.transactions[0]);
    } else {
      console.log('Transaction not found in mirror node');
    }
    return transactionDetails;
  }

  async closeCompletedTransaction() {
    const isCompletedTxModalVisible = await this.isElementVisible(
      this.modalTransactionSuccessSelector,
    );
    if (isCompletedTxModalVisible) {
      await this.clickOnCloseButtonForCompletedTransaction();
    }
  }

  async clickOnTransactionsMenuButton() {
    await this.clickByTestId(this.transactionsMenuButtonSelector);
  }

  async clickOnAccountsMenuButton() {
    await this.clickByTestId(this.accountsMenuButtonSelector);
  }

  async clickOnCreateNewTransactionButton() {
    await this.clickByTestId(this.createNewTransactionButtonSelector);
  }

  /**
   * Generalized function to attempt clicking on a transaction link and check for the visibility of a target element.
   * @param {string} linkSelector - The test ID selector for the transaction link.
   * @param {string} targetSelector - The test ID selector for the target element to verify page transition.
   * @param {string} transactionType - A string representing the type of transaction for logging purposes.
   * @throws {Error} Throws an error if unable to navigate to the transaction page after multiple attempts.
   */
  async clickOnTransactionLink(linkSelector, targetSelector, transactionType) {
    console.log(`Attempting to click on ${transactionType} Transaction link`);
    const maxAttempts = 10; // Maximum number of attempts to find the correct element
    for (let index = 0; index < maxAttempts; index++) {
      try {
        await this.clickByTestIdWithIndex(linkSelector, index);
        // Check if the next page element that should appear is visible
        if (await this.isElementVisible(targetSelector)) {
          console.log(`Successfully navigated to the ${transactionType} Transaction page.`);
          return;
        }
      } catch (error) {
        console.log(
          `Attempt ${index + 1}: Failed to find or click on the correct element, retrying...`,
        );
      }
    }
    throw new Error(
      `Failed to navigate to the ${transactionType} Transaction page after multiple attempts`,
    );
  }

  async clickOnCreateAccountTransaction() {
    await this.clickOnTransactionLink(
      this.createAccountSublinkSelector,
      this.signAndSubmitButtonSelector,
      'Create Account',
    );
  }

  async clickOnDeleteAccountTransaction() {
    await this.clickOnTransactionLink(
      this.deleteAccountSublinkSelector,
      this.transferAccountInputSelector,
      'Delete Account',
    );
  }

  async clickOnUpdateAccountTransaction() {
    await this.clickOnTransactionLink(
      this.updateAccountSublinkSelector,
      this.updateAccountInputSelector,
      'Update Account',
    );
  }

  async clickOnApproveAllowanceTransaction() {
    await this.clickOnTransactionLink(
      this.allowanceSublinkSelector,
      this.signAndSubmitAllowanceSelector,
      'Approve Allowance',
    );
  }

  async clickOnTransferTokensTransaction() {
    await this.clickOnTransactionLink(
      this.transferTokensSublinkSelector,
      this.signAndSubmitTransferSelector,
      'Transfer Tokens',
    );
  }

  async verifyTransactionExists(transactionId, transactionType) {
    const query = `
        SELECT COUNT(*) AS count
        FROM "Transaction"
        WHERE transaction_id = ? AND type = ?`;

    try {
      const row = await queryDatabase(query, [transactionId, transactionType]);
      return row ? row.count > 0 : false;
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }

  async verifyAccountExists(accountId) {
    const query = `
        SELECT COUNT(*) AS count
        FROM HederaAccount
        WHERE account_id = ?`;

    try {
      const row = await queryDatabase(query, [accountId]);
      return row ? row.count > 0 : false;
    } catch (error) {
      console.error('Error verifying account:', error);
      return false;
    }
  }

  async addPublicKeyAtDepth(depth) {
    await this.clickAddButton(depth);
    await this.selectPublicKeyOption(depth);
    const publicKey = await this.generateRandomPublicKey();
    await this.fillInPublicKeyField(publicKey);
    await this.clickInsertPublicKey();
  }

  async addThresholdKeyAtDepth(depth) {
    await this.clickAddButton(depth);
    await this.selectThreshold(depth);
  }

  async createComplexKeyStructure() {
    let currentDepth = '0';

    await this.addThresholdKeyAtDepth(currentDepth, '0');

    await this.addPublicKeyAtDepth(`${currentDepth}-0`);
    await this.addPublicKeyAtDepth(`${currentDepth}-0`);

    await this.addThresholdKeyAtDepth(currentDepth, '0');

    await this.addPublicKeyAtDepth(`${currentDepth}-1`);
    await this.addPublicKeyAtDepth(`${currentDepth}-1`);

    currentDepth = `${currentDepth}-0`;
    await this.addThresholdKeyAtDepth(currentDepth);

    await this.addPublicKeyAtDepth(`0-0-2`);
    await this.addPublicKeyAtDepth(`0-0-2`);
  }

  async decodeByteCode(bytecode) {
    return decodeAndFlattenKeys(bytecode);
  }

  getAllGeneratedPublicKeys() {
    return this.generatedPublicKeys;
  }

  async keysMatch(decodedKeys, generatedKeys) {
    const sortedDecodedKeys = decodedKeys.map(key => key.toLowerCase()).sort();
    const sortedGeneratedKeys = generatedKeys.map(key => key.toLowerCase()).sort();

    if (sortedDecodedKeys.length !== sortedGeneratedKeys.length) {
      return false;
    }

    return sortedDecodedKeys.every((value, index) => value === sortedGeneratedKeys[index]);
  }

  async generateRandomPublicKey() {
    const header = '302a300506032b6570032100';
    const hexChars = '0123456789ABCDEF';
    let publicKey = '';
    for (let i = 0; i < 64; i++) {
      publicKey += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
    }
    const publicKeyWithPrefix = header + publicKey;
    this.generatedPublicKeys.push(publicKeyWithPrefix); // Store the generated public key
    return publicKey;
  }

  /**
   * Finds the index of the element containing the specified account ID.
   * @param {string} accountId - The account ID to search for.
   * @returns {number} The index of the element with the specified account ID, or -1 if not found.
   */
  async findAccountIndexById(accountId) {
    const count = await this.countElementsByTestId(this.accountIdPrefixSelector);
    if (count === 0) {
      return 0;
    } else {
      for (let i = 0; i < count; i++) {
        const idText = await this.getTextByTestId(this.accountIdPrefixSelector + i);
        if (idText === accountId) {
          return i;
        }
      }
      return -1; // Return -1 if the account ID is not found
    }
  }

  async isAccountCardVisible(accountId) {
    await this.waitForElementToBeVisible(this.addNewAccountButtonSelector);
    const index = await this.findAccountIndexById(accountId);
    if (index === -1) {
      return false; // account not found
    } else {
      return await this.isElementVisible(this.accountIdPrefixSelector + index);
    }
  }

  async ensureAccountExists(password) {
    if (await this.isAccountsListEmpty()) {
      await this.createNewAccount(password);
    }
  }

  async createNewAccount(password, options = {}) {
    const {
      isComplex = false,
      maxAutoAssociations = null,
      initialFunds = null,
      isReceiverSigRequired = false,
      memo = null,
    } = options;

    await this.clickOnCreateNewTransactionButton();
    await this.clickOnCreateAccountTransaction();

    // Handle complex key creation
    if (isComplex) {
      await this.handleComplexKeyCreation();
    }

    // Handle optional settings
    const optionHandlers = [
      {
        condition: maxAutoAssociations !== null,
        handler: () => this.fillInMaxAccountAssociations(maxAutoAssociations.toString()),
      },
      { condition: initialFunds !== null, handler: () => this.fillInInitialFunds(initialFunds) },
      { condition: isReceiverSigRequired, handler: () => this.clickOnReceiverSigRequiredSwitch() },
      { condition: memo !== null, handler: () => this.fillInMemo(memo) },
    ];

    for (const { condition, handler } of optionHandlers) {
      if (condition) await handler();
    }

    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.fillInPassword(password);
    await this.clickOnPasswordContinue();
    await this.waitForSuccessModalToAppear();

    const [newAccountId, newTransactionId] = await Promise.all([
      this.getNewAccountIdText(),
      this.getNewTransactionIdText(),
    ]);

    await this.clickOnCloseButtonForCompletedTransaction();
    await this.addAccountsToList(newAccountId);

    return { newAccountId, newTransactionId };
  }

  // Helper method for complex key creation
  async handleComplexKeyCreation() {
    await this.clickOnComplexTab();
    await this.clickOnCreateNewComplexKeyButton();
    await this.createComplexKeyStructure();
    await this.clickOnDoneButton();
  }

  async deleteAccount(accountId, password) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnDeleteAccountTransaction();
    await this.fillInTransferAccountId();
    await this.fillInDeletedAccountId(accountId);
    await this.clickOnSignAndSubmitDeleteButton();
    await this.clickSignTransactionButton();
    await this.fillInPassword(password);
    await this.clickOnPasswordContinue();
    await this.waitForSuccessModalToAppear();
    const transactionId = await this.getTransactionIdText();
    await this.clickOnCloseButtonForCompletedTransaction();
    await this.removeAccountFromList(accountId);
    return transactionId;
  }

  async updateAccount(accountId, password, maxAutoAssociations, memo) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnUpdateAccountTransaction();
    await this.fillInUpdatedAccountId(accountId);
    await this.fillInMaxAutoAssociations(maxAutoAssociations);
    await this.fillInMemoUpdate(memo);
    await this.clickOnAcceptStakingRewardsSwitch(); //disabling staking rewards
    await this.waitForElementPresentInDOM(this.updateAccountIdFetchedDivSelector, 30000);
    await this.clickOnSignAndSubmitUpdateButton();
    await this.clickSignTransactionButton();
    await this.fillInPassword(password);
    await this.clickOnPasswordContinue();
    await this.waitForSuccessModalToAppear();
    const transactionId = await this.getTransactionIdText();
    await this.clickOnCloseButtonForCompletedTransaction();
    return transactionId;
  }

  async approveAllowance(spenderAccountId, amount, password, isTestNegative = false) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnApproveAllowanceTransaction();
    if (isTestNegative) {
      await this.fillByTestId(this.allowanceOwnerAccountSelector, '0.0.999');
    } else {
      await this.fillInAllowanceOwnerAccount();
    }
    await this.fillInAllowanceAmount(amount);
    await this.fillInSpenderAccountId(spenderAccountId);
    await this.clickOnSignAndSubmitAllowanceButton();
    await this.clickSignTransactionButton();
    await this.fillInPassword(password);
    await this.clickOnPasswordContinue();
    await this.waitForSuccessModalToAppear();
    const transactionId = await this.getTransactionIdText();
    await this.clickOnCloseButtonForCompletedTransaction();
    return transactionId;
  }

  async transferAmountBetweenAccounts(toAccountId, amount, password, options = {}) {
    const { isSupposedToFail = false } = options;

    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnTransferTokensTransaction();
    await this.fillInTransferFromAccountId();
    await this.fillInTransferAmountFromAccount(amount);
    await this.fillInTransferToAccountId(toAccountId);
    await this.clickOnAddTransferFromButton();
    await this.fillInTransferAmountToAccount(amount);
    await this.clickOnAddTransferToButton();

    await this.clickOnSignAndSubmitTransferButton();
    await this.clickSignTransactionButton();
    await this.fillInPassword(password);
    await this.clickOnPasswordContinue();

    if (isSupposedToFail) {
      return null;
    } else {
      await this.waitForSuccessModalToAppear();
      const transactionId = await this.getTransactionIdText();
      await this.clickOnCloseButtonForCompletedTransaction();
      return transactionId;
    }
  }

  async clickOnReceiverSigRequiredSwitch() {
    await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchSelector);
  }

  async clickOnAcceptStakingRewardsSwitch() {
    await this.toggleSwitchByTestId(this.acceptStakingRewardsSwitchSelector);
  }

  async fillInMemo(memo) {
    await this.fillByTestId(this.accountMemoInputSelector, memo);
  }

  async fillInInitialFunds(amount) {
    await this.fillByTestId(this.initialBalanceInputSelector, amount);
  }

  async fillInMaxAccountAssociations(amount) {
    await this.fillByTestId(this.maxAutoAssociationsInputSelector, amount);
  }

  async clickOnSignAndSubmitButton() {
    await this.clickByTestId(this.signAndSubmitButtonSelector);
  }

  async clickOnSignAndSubmitDeleteButton() {
    await this.clickByTestId(this.signAndSubmitDeleteButtonSelector);
  }

  async clickOnSignAndSubmitUpdateButton() {
    await this.clickByTestId(this.signAndSubmitUpdateButtonSelector);
  }

  async clickSignTransactionButton() {
    // Construct the selector for the confirmation transaction modal that is visible and in a displayed state
    const modalSelector = `[data-testid="${this.confirmTransactionModalSelector}"][style*="display: block"]`;
    await this.window.waitForSelector(modalSelector, { state: 'visible', timeout: 15000 });

    // Construct the selector for the enabled sign button within the visible modal
    const signButtonSelector = `${modalSelector} [data-testid="${this.buttonSignTransactionSelector}"]:enabled`;

    // Wait for the sign button to be visible and enabled, then attempt to click it
    await this.window.waitForSelector(signButtonSelector, { state: 'visible', timeout: 15000 });
    await this.window.click(signButtonSelector);

    // After clicking the sign button, wait for the password input to become visible
    await this.waitForElementToBeVisible(this.passwordSignTransactionInputSelector);
  }

  async clickOnPasswordContinue() {
    await this.clickByTestId(this.passwordContinueButtonSelector);
  }

  async clickOnCloseButtonForCompletedTransaction() {
    await this.clickByTestId(this.closeCompletedTxButtonSelector);
  }

  async fillInPassword(password) {
    await this.fillByTestId(this.passwordSignTransactionInputSelector, password);
  }

  async clickOnCancelTransaction() {
    await this.clickByTestId(this.buttonCancelTransactionSelector);
  }

  async waitForSuccessModalToAppear() {
    await this.waitForElementToBeVisible(this.successCheckMarkIconSelector, 25000);
  }

  async getNewAccountIdText() {
    return await this.getTextByTestId(this.newlyCreatedAccountIdSelector);
  }

  async getTransactionIdText() {
    return await this.getTextByTestId(this.linkTransactionIdSelector);
  }

  async getNewTransactionIdText() {
    return await this.getTextByTestId(this.newlyCreatedTransactionIdSelector);
  }

  async clickAddButton(depth) {
    await this.clickByTestId(this.addComplexButtonIndex + depth);
  }

  async selectPublicKeyOption(depth) {
    await this.clickByTestId(this.addPublicKeyButtonIndex + depth);
  }

  async selectThreshold(depth) {
    await this.clickByTestId(this.selectThresholdNumberIndex + depth);
  }

  async fillInPublicKeyField(publicKey) {
    await this.fillByTestId(this.publicKeyComplexInputSelector, publicKey);
  }

  async clickInsertPublicKey() {
    await this.clickByTestId(this.insertPublicKeyButtonSelector);
  }

  async clickOnCreateNewComplexKeyButton() {
    await this.clickByTestId(this.spanCreateNewComplexKeyButtonSelector);
  }

  async clickOnComplexTab() {
    await this.clickByTestId(this.complexTabSelector);
  }

  async clickOnDoneButton() {
    await this.clickByTestId(this.doneComplexKeyButtonSelector);
  }

  /**
   * Generalized function to fill in the account ID input field, remove the last character,
   * type it again to trigger UI updates, and retry until the target button is enabled.
   * @param {string} accountId - The account ID to be filled in.
   * @param {string} inputSelector - The test ID selector for the input field.
   * @param {string} buttonSelector - The test ID selector for the button to check.
   */
  async fillInAccountId(accountId, inputSelector, buttonSelector) {
    const maxRetries = 50; // Maximum number of retries before giving up
    let attempt = 0;

    while (attempt < maxRetries) {
      const { delay } = await import('../utils/util.js');
      // Fill the input normally
      const element = this.window.getByTestId(inputSelector);
      await element.fill(accountId);

      // Grab the last character of accountId and prepare the version without the last char
      const lastChar = accountId.slice(-1);
      const withoutLastChar = accountId.slice(0, -1);

      // Clear the input and retype it without the last character
      await element.fill(withoutLastChar);

      // Type the last character
      await this.window.keyboard.type(lastChar);

      // Check if the target button is enabled
      if (await this.isButtonEnabled(buttonSelector)) {
        return; // Exit the function if the button is enabled
      }

      // Wait a short period before retrying to allow for UI updates
      await delay(100); // Wait for 100 milliseconds

      attempt++; // Increment the attempt counter
    }

    throw new Error(
      `Failed to enable the button after multiple attempts. Selector: ${buttonSelector}`,
    );
  }

  async fillInDeletedAccountId(accountId) {
    await this.fillInAccountId(
      accountId,
      this.deletedAccountInputSelector,
      this.signAndSubmitDeleteButtonSelector,
    );
  }

  async fillInUpdatedAccountId(accountId) {
    await this.fillInAccountId(
      accountId,
      this.updateAccountInputSelector,
      this.signAndSubmitUpdateButtonSelector,
    );
  }

  async fillInSpenderAccountId(accountId) {
    await this.fillInAccountId(
      accountId,
      this.allowanceSpenderAccountSelector,
      this.signAndSubmitAllowanceSelector,
    );
  }

  async fillInTransferAccountId() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fillByTestId(this.transferAccountInputSelector, firstAccountId);
  }

  async getFirstAccountIdFromText(allAccountIds) {
    const accountIdsArray = allAccountIds.split(' ');
    return accountIdsArray[0];
  }

  async getPayerAccountId() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    return await this.getFirstAccountIdFromText(allAccountIdsText);
  }

  async addAccountsToList(accountId) {
    this.generatedAccounts.push(accountId);
  }

  async removeAccountFromList(accountId) {
    this.generatedAccounts = this.generatedAccounts.filter(id => id !== accountId);
  }

  async isAccountsListEmpty() {
    return this.generatedAccounts.length === 0;
  }

  async getFirstAccountFromList() {
    return this.generatedAccounts[0];
  }

  async fillInMaxAutoAssociations(amount) {
    await this.fillByTestId(this.maxAutoAssociationsUpdateInputSelector, amount);
  }

  async fillInMemoUpdate(memo) {
    await this.fillByTestId(this.memoUpdateInputSelector, memo);
  }

  async fillInTransferFromAccountId() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fillByTestId(this.transferFromAccountIdInputSelector, firstAccountId);
  }

  async fillInTransferAmountFromAccount(amount) {
    await this.fillByTestId(this.transferAmountFromAccountInputSelector, amount);
  }

  async fillInTransferToAccountId(accountId) {
    await this.fillByTestId(this.transferToAccountIdInputSelector, accountId);
  }

  async fillInTransferAmountToAccount(amount) {
    await this.fillByTestId(this.transferAmountToAccountInputSelector, amount);
  }

  async clickOnAddTransferFromButton() {
    await this.clickByTestId(this.addTransferFromButtonSelector);
  }

  async clickOnAddTransferToButton() {
    await this.clickByTestId(this.addTransferToButtonSelector);
  }

  async clickOnAddRestButton() {
    await this.clickByTestId(this.addRestButtonSelector);
  }

  async clickOnSignAndSubmitTransferButton() {
    await this.clickByTestId(this.signAndSubmitTransferSelector);
  }

  async getHbarAmountValueForTwoAccounts() {
    return await this.getAllTextByTestId(this.hbarAmountValueSelector);
  }

  async isSignAndSubmitButtonEnabled() {
    return await this.isButtonEnabled(this.signAndSubmitTransferSelector);
  }

  async fillInAllowanceOwnerAccount() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fillByTestId(this.allowanceOwnerAccountSelector, firstAccountId);
  }

  async fillInAllowanceAmount(amount) {
    await this.fillByTestId(this.allowanceAmountSelector, amount);
  }

  async clickOnSignAndSubmitAllowanceButton() {
    await this.clickByTestId(this.signAndSubmitAllowanceSelector);
  }
}

module.exports = TransactionPage;
