const BasePage = require('./BasePage');
const { getAccountDetails, pollForAccountDetails } = require('../utils/mirrorNodeAPI');
const { queryDatabase } = require('../utils/databaseUtil');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');

class TransactionPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.generatedPublicKeys = []; // Store generated public keys
  }

  transactionsMenuButtonSelector = 'button-menu-transactions';
  createNewTransactionButtonSelector = 'button-create-new';
  createAccountSublinkSelector = 'menu-sublink-1';
  saveDraftButtonSelector = 'button-save-draft';
  signAndSubmitButtonSelector = 'button-sign-and-submit';
  payerDropdownSelector = 'dropdown-payer';
  singleTabSelector = 'tab-single';
  complexTabSelector = 'tab-complex';
  selectKeySpanSelector = 'span-select-key';
  publicKeyInputSelector = 'input_public_key';
  transactionMemoInputSelector = 'input-transaction-memo';
  acceptStakingRewardsSwitchSelector = 'switch-accept-staking-rewards';
  stakingDropdownSelector = 'dropdown-staking-account';
  noneStakingOptionSelector = 'option-none';
  accountStakingOptionSelector = 'option-account';
  nodeStakingOptionSelector = 'option-node';
  receiverSigRequiredSwitchSelector = 'switch-receiver-sig-required';
  initialBalanceInputSelector = 'input-initial-balance-amount';
  maxAutoAssociationsInputSelector = 'input-max-auto-associations';
  accountMemoInputSelector = 'input-account-memo';
  nicknameInputSelector = 'input-nickname';
  discardModalDraftButtonSelector = 'button-discard-draft-modal';
  saveModalDraftButtonSelector = 'button-save-draft-modal';
  textTypeTransactionSelector = 'p-type-transaction';
  textTransactionIdSelector = 'p-transaction-id';
  textMaxTxFeeSelector = 'p-max-tx-fee';
  buttonSignTransactionSelector = 'button-sign-transaction';
  buttonCancelTransactionSelector = 'button-cancel-transaction';
  passwordSignTransactionInputSelector = 'input-password-transaction';
  passwordContinueButtonSelector = 'button-password-continue';
  closeCompletedTxButtonSelector = 'button-close-completed-tx';
  loaderDivSelector = 'div-loader';
  successCheckMarkIconSelector = 'icon-success-checkmark';
  modalTransactionSuccessSelector = 'modal-transaction-success';
  newlyCreatedAccountIdSelector = 'p-new-crated-account-id';
  newlyCreatedTransactionIdSelector = 'a-transaction-id';
  addComplexButtonIndex = 'button-complex-key-add-element-';
  selectThresholdNumberIndex = 'button-complex-key-add-element-threshold-';
  publicKeyInputTextIndex = 'input-complex-key-public-key-';
  addPublicKeyButtonIndex = 'button-complex-key-add-element-public-key-';
  publicKeyComplexInputSelector = 'input-complex-public-key';
  insertPublicKeyButtonSelector = 'button-insert-public-key';
  spanCreateNewComplexKeyButtonSelector = 'span-create-new-complex-key';
  doneComplexKeyButtonSelector = 'button-complex-key-done';

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

  async clickOnStakingDropDown() {
    await this.clickByTestId(this.stakingDropdownSelector);
  }

  async clickOnStakingOptionNode() {
    await this.clickByTestId(this.nodeStakingOptionSelector);
  }

  async clickOnReceiverSigRequiredSwitch() {
    await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchSelector);
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

  async clickSignTransactionButton() {
    await this.clickByTestId(this.buttonSignTransactionSelector);
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
    await this.waitForElementToBeVisible(this.modalTransactionSuccessSelector, 30000);
  }

  async getNewAccountIdText() {
    return await this.getTextByTestId(this.newlyCreatedAccountIdSelector);
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

  async getPublicKeyTextByDepth(depth) {
    await this.clickByTestId(this.publicKeyInputTextIndex + depth);
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
}

module.exports = TransactionPage;
