const BasePage = require('./BasePage');
const { getAccountDetails, getTransactionDetails } = require('../utils/mirrorNodeAPI');
const { queryDatabase } = require('../utils/databaseUtil');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');
const { delay } = require('../utils/util.js');

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
  publicKeyInputTextIndex = 'input-complex-key-public-key-';
  publicKeyComplexInputSelector = 'input-complex-public-key';
  deletedAccountInputSelector = 'input-delete-account-id';
  transferAccountInputSelector = 'input-transfer-account-id';
  updateAccountInputSelector = 'input-account-id-for-update';
  maxAutoAssociationsUpdateInputSelector = 'input-max-auto-token-associations';
  memoUpdateInputSelector = 'input-memo-update';

  //Buttons
  transactionsMenuButtonSelector = 'button-menu-transactions';
  accountsMenuButtonSelector = 'button-menu-accounts';
  createNewTransactionButtonSelector = 'button-create-new';
  createAccountSublinkSelector = 'menu-sublink-0';
  updateAccountSublinkSelector = 'menu-sublink-1';
  deleteAccountSublinkSelector = 'menu-sublink-3';
  saveDraftButtonSelector = 'button-save-draft';
  signAndSubmitButtonSelector = 'button-sign-and-submit';
  signAndSubmitDeleteButtonSelector = 'button-sign-and-submit-delete';
  signAndSubmitUpdateButtonSelector = 'button-sign-and-submit-update';
  payerDropdownSelector = 'dropdown-payer';
  singleTabSelector = 'tab-single';
  complexTabSelector = 'tab-complex';
  stakingDropdownSelector = 'dropdown-staking-account';
  nodeStakingOptionSelector = 'option-node';
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
   * Attempts to click on the 'Create Account Transaction' link by testing different indices of the same test ID.
   * This method is designed to handle scenarios where the same test ID may be used for multiple elements and only
   * one of them is the correct target at any given time.
   *
   * The function iterates through possible indices of the test ID, attempting to click each and then checking if
   * this action leads to the expected page transition by verifying the visibility of a specific element on the
   * subsequent page (e.g., 'Sign and Submit' button).
   *
   * @throws {Error} Throws an error if unable to navigate to the Create Account Transaction page after multiple attempts.
   */
  async clickOnCreateAccountTransaction() {
    console.log('Attempting to click on Create Account Transaction link');
    const maxAttempts = 10; // Maximum number of attempts to find the correct element
    for (let index = 0; index < maxAttempts; index++) {
      try {
        await this.clickByTestIdWithIndex(this.createAccountSublinkSelector, index);
        // Check if the next page element that should appear is visible
        if (await this.isElementVisible(this.signAndSubmitButtonSelector)) {
          console.log('Successfully navigated to the Create Account Transaction page.');
          return;
        }
      } catch (error) {
        console.log(
          `Attempt ${index + 1}: Failed to find or click on the correct element, retrying...`,
        );
      }
    }
    throw new Error(
      'Failed to navigate to the Create Account Transaction page after multiple attempts',
    );
  }

  async clickOnDeleteAccountTransaction() {
    console.log('Attempting to click on Delete Account Transaction link');
    const maxAttempts = 10; // Maximum number of attempts to find the correct element
    for (let index = 0; index < maxAttempts; index++) {
      try {
        await this.clickByTestIdWithIndex(this.deleteAccountSublinkSelector, index);
        // Check if the next page element that should appear is visible
        if (await this.isElementVisible(this.transferAccountInputSelector)) {
          console.log('Successfully navigated to the Create Account Transaction page.');
          return;
        }
      } catch (error) {
        console.log(
          `Attempt ${index + 1}: Failed to find or click on the correct element, retrying...`,
        );
      }
    }
    throw new Error(
      'Failed to navigate to the Delete Account Transaction page after multiple attempts',
    );
  }

  async clickOnUpdateAccountTransaction() {
    console.log('Attempting to click on Update Account Transaction link');
    const maxAttempts = 10; // Maximum number of attempts to find the correct element
    for (let index = 0; index < maxAttempts; index++) {
      try {
        await this.clickByTestIdWithIndex(this.updateAccountSublinkSelector, index);
        // Check if the next page element that should appear is visible
        if (await this.isElementVisible(this.updateAccountInputSelector)) {
          console.log('Successfully navigated to the Create Account Transaction page.');
          return;
        }
      } catch (error) {
        console.log(
          `Attempt ${index + 1}: Failed to find or click on the correct element, retrying...`,
        );
      }
    }
    throw new Error(
      'Failed to navigate to the Update Account Transaction page after multiple attempts',
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
    // Construct the selector for the confirm transaction modal that is visible and in a displayed state
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
   * Fills in the deleted account ID input field, removes the last character, and types it again to trigger UI updates.
   * Continuously retries until the 'Sign and Submit' button is enabled or a max attempt limit is reached.
   * @param {string} accountId - The account ID to be filled in.
   */
  async fillInDeletedAccountId(accountId) {
    const maxRetries = 50; // Maximum number of retries before giving up
    let attempt = 0;

    while (attempt < maxRetries) {
      // Fill the input normally
      // Not using BasePage due to spam in the logs
      const element = this.window.getByTestId(this.deletedAccountInputSelector);
      await element.fill(accountId);

      // Grab the last character of accountId and prepare the version without the last char
      const lastChar = accountId.slice(-1);
      const withoutLastChar = accountId.slice(0, -1);

      // Clear the input and retype it without the last character
      await element.fill(withoutLastChar);

      // Type the last character
      await this.window.keyboard.type(lastChar);

      // Check if the 'Sign and Submit' button is enabled
      if (await this.isButtonEnabled(this.signAndSubmitDeleteButtonSelector)) {
        return; // Exit the function if the button is enabled
      }

      // Wait a short period before retrying to allow for UI updates
      await delay(100); // Wait for 100 milliseconds

      attempt++; // Increment the attempt counter
    }

    throw new Error('Failed to enable the Sign and Submit button after multiple attempts.');
  }

  async fillInUpdatedAccountId(accountId) {
    const maxRetries = 50; // Maximum number of retries before giving up
    let attempt = 0;

    while (attempt < maxRetries) {
      // Fill the input normally
      // Not using BasePage due to spam in the logs
      const element = this.window.getByTestId(this.updateAccountInputSelector);
      await element.fill(accountId);

      // Grab the last character of accountId and prepare the version without the last char
      const lastChar = accountId.slice(-1);
      const withoutLastChar = accountId.slice(0, -1);

      // Clear the input and retype it without the last character
      await element.fill(withoutLastChar);

      // Type the last character
      await this.window.keyboard.type(lastChar);

      // Check if the 'Sign and Submit' button is enabled
      if (await this.isButtonEnabled(this.signAndSubmitUpdateButtonSelector)) {
        return; // Exit the function if the button is enabled
      }

      // Wait a short period before retrying to allow for UI updates
      await delay(100); // Wait for 100 milliseconds

      attempt++; // Increment the attempt counter
    }

    throw new Error('Failed to enable the Sign and Submit button after multiple attempts.');
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
}

module.exports = TransactionPage;
