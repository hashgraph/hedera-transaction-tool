const path = require('path');
const BasePage = require('./BasePage');
const { getAccountDetails, getTransactionDetails } = require('../utils/mirrorNodeAPI');
const {
  verifyTransactionExists,
  verifyAccountExists,
  verifyFileExists,
} = require('../utils/databaseQueries');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');
const { getCleanAccountId } = require('../utils/util');

class TransactionPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.generatedPublicKeys = []; // Store generated public keys
    this.generatedAccounts = []; // Store generated accounts from create account transaction
    this.generatedFiles = {}; // Store generated files from create file transaction with key-value pairs
  }

  /* Selectors */

  //Inputs
  initialBalanceInputSelector = 'input-initial-balance-amount';
  maxAutoAssociationsInputSelector = 'input-max-auto-token-associations';
  accountMemoInputSelector = 'input-account-memo';
  nicknameInputSelector = 'input-nickname';
  publicKeyComplexInputSelector = 'input-complex-public-key';
  deletedAccountInputSelector = 'input-delete-account-id';
  transferAccountInputSelector = 'input-transfer-account-id';
  updateAccountInputSelector = 'input-account-id-for-update';
  maxAutoAssociationsUpdateInputSelector = 'input-max-auto-token-associations';
  memoUpdateInputSelector = 'input-account-memo';
  transactionMemoInputSelector = 'input-transaction-memo';
  transferFromAccountIdInputSelector = 'input-transfer-from-account';
  transferAmountFromAccountInputSelector = 'input-transfer-from-amount';
  transferToAccountIdInputSelector = 'input-transfer-to-account';
  transferAmountToAccountInputSelector = 'input-transfer-to-amount';
  allowanceOwnerAccountSelector = 'input-owner-account';
  allowanceSpenderAccountSelector = 'input-spender-account';
  allowanceAmountSelector = 'input-allowance-amount';
  fileContentTextFieldSelector = 'textarea-file-content';
  fileIdInputForReadSelector = 'input-file-id-for-read';
  fileContentReadTextFieldSelector = 'text-area-read-file-content';
  publicKeyInputSelector = 'input-public-key';
  fileIdUpdateInputSelector = 'input-file-id-for-update';
  fileContentUpdateTextFieldSelector = 'textarea-file-content';
  fileIdInputForAppendSelector = 'input-file-id-for-append';
  fileContentAppendTextFieldSelector = 'textarea-file-content';
  fileMemoInputSelector = 'input-file-memo';
  fileCreateExpirationDateInputSelector = 'input-expiration-time-for-file';
  fileCreateNameInputSelector = 'input-file-name-for-file-create';
  fileCreateDescriptionInputSelector = 'input-file-description-for-file-create';
  maxTransactionFeeInputSelector = 'input-max-transaction-fee';
  descriptionInputSelector = 'input-transaction-description';
  complexKeyAccountIdInputSelector = 'input-complex-key-account-id';

  //Buttons
  transactionsMenuButtonSelector = 'button-menu-transactions';
  accountsMenuButtonSelector = 'button-menu-accounts';
  createNewTransactionButtonSelector = 'button-create-new';
  fileServiceLinkSelector = 'menu-link-file';
  createAccountSublinkSelector = 'menu-sub-link-accountcreatetransaction';
  updateAccountSublinkSelector = 'menu-sub-link-accountupdatetransaction';
  deleteAccountSublinkSelector = 'menu-sub-link-accountdeletetransaction';
  transferTokensSublinkSelector = 'menu-sub-link-transfertransaction';
  allowanceSublinkSelector = 'menu-sub-link-accountallowanceapprovetransaction';
  createFileSublinkSelector = 'menu-sub-link-filecreatetransaction';
  updateFileSublinkSelector = 'menu-sub-link-fileupdatetransaction';
  readFileSublinkSelector = 'menu-sub-link-filecontentsquery';
  appendFileSublinkSelector = 'menu-sub-link-fileappendtransaction';
  saveDraftButtonSelector = 'button-save-draft';
  signAndSubmitButtonSelector = 'button-header-create';
  payerDropdownSelector = 'dropdown-payer';
  singleTabSelector = 'tab-single';
  complexTabSelector = 'tab-complex';
  receiverSigRequiredSwitchSelector = 'switch-receiver-sig-required';
  receiverSigRequiredSwitchForUpdateSelector = 'switch-receiver-sig-required';
  acceptStakingRewardsSwitchSelector = 'switch-accept-staking-rewards';
  discardModalDraftButtonSelector = 'button-discard-draft-modal';
  buttonSignTransactionSelector = 'button-sign-transaction';
  buttonCancelTransactionSelector = 'button-cancel-transaction';
  closeCompletedTxButtonSelector = 'button-close-completed-tx';
  addComplexButtonIndex = 'button-complex-key-add-element-';
  selectThresholdValueByIndex = 'select-complex-key-threshold-';
  selectThresholdNumberIndex = 'button-complex-key-add-element-threshold-';
  addPublicKeyButtonIndex = 'button-complex-key-add-element-public-key-';
  addAccountButtonIndex = 'button-complex-key-add-element-account-';
  insertPublicKeyButtonSelector = 'button-insert-public-key';
  doneComplexKeyButtonSelector = 'button-complex-key-done';
  addNewAccountButtonSelector = 'button-add-new-account';
  addTransferFromButtonSelector = 'button-add-transfer-from';
  addRestButtonSelector = 'button-transfer-to-rest';
  addTransferToButtonSelector = 'button-add-transfer-to';
  draftsTabSelector = 'tab-0';
  draftDeleteButtonIndexSelector = 'button-draft-delete-';
  draftContinueButtonIndexSelector = 'button-draft-continue-';
  confirmDeleteAccountButtonSelector = 'button-confirm-delete-account';
  singleTransactionButtonSelector = 'span-single-transaction';
  uploadFileButtonSelector = '#append-transaction-file[type="file"]';
  insertAccountIdButtonSelector = 'button-insert-account-id';

  //Other
  confirmTransactionModalSelector = 'modal-confirm-transaction';
  spanCreateNewComplexKeyButtonSelector = 'span-create-new-complex-key';
  updateAccountIdFetchedDivSelector = 'div-account-info-fetched';

  //Messages
  textTypeTransactionSelector = 'p-type-transaction';
  textTransactionIdSelector = 'p-transaction-id';
  textMaxTxFeeSelector = 'p-max-tx-fee';
  toastMessageSelector = '.v-toast__text';
  hbarAmountValueSelector = 'p-hbar-amount';
  transactionTypeHeaderSelector = 'h2-transaction-type';
  transactionDetailsCreatedAtSelector = 'p-transaction-details-created-at';
  transactionDetailsIdSelector = 'p-transaction-details-id';
  approveAllowanceTransactionMemoSelector = 'input-transaction-memo';

  //Indexes
  accountIdPrefixSelector = 'p-account-id-';
  draftDetailsDateIndexSelector = 'span-draft-tx-date-';
  draftDetailsTypeIndexSelector = 'span-draft-tx-type-';
  draftDetailsIsTemplateCheckboxSelector = 'checkbox-is-template-';

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

  async verifyFileCreateTransactionElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.signAndSubmitButtonSelector),
      this.isElementVisible(this.fileContentTextFieldSelector),
      this.isElementVisible(this.transactionMemoInputSelector),
      this.isElementVisible(this.fileMemoInputSelector),
      this.isElementVisible(this.fileCreateExpirationDateInputSelector),
      this.isElementVisible(this.fileCreateNameInputSelector),
      this.isElementVisible(this.fileCreateDescriptionInputSelector),
      this.isElementVisible(this.fileContentTextFieldSelector),
      this.isElementVisible(this.signAndSubmitButtonSelector),
    ]);
    return checks.every(isTrue => isTrue);
  }

  async verifyConfirmTransactionInformation(typeTransaction) {
    await this.window.waitForSelector(
      '[data-testid="modal-confirm-transaction"][style*="display: block"]',
      { state: 'visible', timeout: 10000 },
    );
    const regex = /^\d+\.\d+\.\d+@\d+\.\d+$/;
    const transactionId = await this.getText(this.textTransactionIdSelector);
    const txType = await this.getText(this.textTypeTransactionSelector);
    const maxTxFee = await this.getText(this.textMaxTxFeeSelector);
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

  async clickOnTransactionsMenuButton() {
    await this.click(this.transactionsMenuButtonSelector, null, 2500);
  }

  async clickOnSingleTransactionButton() {
    await this.click(this.singleTransactionButtonSelector);
  }

  async clickOnAccountsMenuButton() {
    await this.click(this.accountsMenuButtonSelector);
  }

  async clickOnCreateNewTransactionButton() {
    await this.click(this.createNewTransactionButtonSelector);
    await this.clickOnSingleTransactionButton();
  }

  async clickOnCreateAccountTransaction() {
    await this.click(this.createAccountSublinkSelector);
  }

  async clickOnDeleteAccountTransaction() {
    await this.click(this.deleteAccountSublinkSelector);
  }

  async clickOnUpdateAccountTransaction() {
    await this.click(this.updateAccountSublinkSelector);
  }

  async clickOnApproveAllowanceTransaction() {
    await this.click(this.allowanceSublinkSelector);
  }

  async clickOnTransferTokensTransaction() {
    await this.click(this.transferTokensSublinkSelector);
  }

  async clickOnFileCreateTransaction() {
    await this.click(this.createFileSublinkSelector);
  }

  async clickOnReadCreateTransaction() {
    await this.click(this.readFileSublinkSelector);
  }

  async clickOnUpdateFileSublink() {
    await this.click(this.updateFileSublinkSelector);
  }

  async clickOnAppendFileSublink() {
    await this.click(this.appendFileSublinkSelector);
  }

  async verifyTransactionExists(transactionId, transactionType) {
    return await verifyTransactionExists(transactionId, transactionType);
  }

  async verifyAccountExists(accountId) {
    return await verifyAccountExists(accountId);
  }

  async verifyFileExists(fileId) {
    return await verifyFileExists(fileId);
  }

  async addPublicKeyAtDepth(depth, publicKey = null) {
    await this.clickAddButton(depth);
    await this.selectPublicKeyOption(depth);
    if (publicKey === null) {
      publicKey = await this.generateRandomPublicKey();
    }
    await this.fillInPublicKeyField(publicKey);
    await this.clickInsertPublicKey();
  }

  async addAccountAtDepth(depth, accountId) {
    await this.clickAddButton(depth);
    await this.selectAccountKeyOption(depth);
    await this.fillInComplexAccountID(accountId);
    await this.clickOnInsertAccountIdButton();
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
    const count = await this.countElements(this.accountIdPrefixSelector);
    if (count === 0) {
      return 0;
    } else {
      for (let i = 0; i < count; i++) {
        const idText = getCleanAccountId(await this.getText(this.accountIdPrefixSelector + i));
        if (idText === accountId) {
          return i;
        }
      }
      return -1; // Return -1 if the account ID is not found
    }
  }

  async isAccountCardVisible(accountId) {
    await this.waitForElementToBeVisible(this.addNewAccountButtonSelector, 8000);
    const index = await this.findAccountIndexById(accountId);
    if (index === -1) {
      return false; // account not found
    } else {
      return await this.isElementVisible(this.accountIdPrefixSelector + index);
    }
  }

  async ensureAccountExists() {
    if (await this.isAccountsListEmpty()) {
      await this.createNewAccount();
    }
  }

  async ensureFileExists(text) {
    if (await this.isGeneratedFilesEmpty()) {
      await this.createFile(text);
    }
  }

  async createNewAccount(options = {}, isComingFromDraft = false) {
    const {
      isComplex = false,
      maxAutoAssociations = null,
      initialFunds = null,
      isReceiverSigRequired = false,
      memo = null,
      description = null,
    } = options;
    if (!isComingFromDraft) {
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnCreateAccountTransaction();
    }

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
      { condition: description !== null, handler: () => this.fillInDescription(description) },
    ];

    for (const { condition, handler } of optionHandlers) {
      if (condition) await handler();
    }

    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();

    const newTransactionId = await this.getTransactionDetailsId();
    const transactionDetails = await this.mirrorGetTransactionResponse(newTransactionId);
    const newAccountId = transactionDetails.transactions[0].entity_id;

    await this.clickOnTransactionsMenuButton();
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

  async deleteAccount(accountId) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnDeleteAccountTransaction();
    await this.fillInTransferAccountId();
    await this.fillInDeletedAccountId(accountId);
    await this.clickOnSignAndSubmitButton();
    await this.clickOnConfirmDeleteAccountButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    await this.removeAccountFromList(accountId);
    return transactionId;
  }

  async updateAccount(accountId, maxAutoAssociations, memo) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnUpdateAccountTransaction();
    await this.fillInUpdatedAccountId(accountId);
    await this.fillInMaxAutoAssociations(maxAutoAssociations);
    await this.fillInMemoUpdate(memo);
    await this.fillInTransactionMemoUpdate('Transaction memo update');
    if (await this.isSwitchToggledOn(this.acceptStakingRewardsSwitchSelector)) {
      await this.clickOnAcceptStakingRewardsSwitch(); //disabling staking rewards
    }
    await this.waitForElementPresentInDOM(this.updateAccountIdFetchedDivSelector, 30000);
    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    return transactionId;
  }

  async waitForCreatedAtToBeVisible() {
    await this.waitForElementToBeVisible(this.transactionDetailsCreatedAtSelector, 25000);
  }

  async getTransactionDetailsId() {
    return await this.getText(this.transactionDetailsIdSelector);
  }

  async createFile(fileContent) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnFileServiceLink();
    await this.clickOnFileCreateTransaction();
    const publicKey = await this.getPublicKeyText();
    await this.fillInFileContent(fileContent);
    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    const transactionDetails = await this.mirrorGetTransactionResponse(transactionId);
    const fileId = transactionDetails.transactions[0].entity_id;
    await this.addGeneratedFile(fileId, fileContent, publicKey);
    return { transactionId, fileId };
  }

  async readFile(fileId) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnFileServiceLink();
    await this.clickOnReadCreateTransaction();
    await this.fillInFileIdForRead(fileId);
    await this.clickOnSignAndSubmitButton();
    await this.waitForElementToDisappear(this.toastMessageSelector);
    return await this.readFileContentFromTextArea();
  }

  async updateFile(fileId, fileContent) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnFileServiceLink();
    await this.clickOnUpdateFileSublink();
    await this.fillInFileIdForUpdate(fileId);
    const publicKey = await this.getPublicKeyFromFile(fileId);
    await this.fillInPublicKeyForFile(publicKey);
    await this.fillInFileContentForUpdate(fileContent);
    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    await this.updateFileText(fileId, fileContent);
    return transactionId;
  }

  async appendFile(fileId, fileContent) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnFileServiceLink();
    await this.clickOnAppendFileSublink();
    await this.fillInFileIdForAppend(fileId);
    const publicKey = await this.getPublicKeyFromFile(fileId);
    await this.fillInPublicKeyForFile(publicKey);
    await this.fillInFileContentForAppend(fileContent);
    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    await this.appendToFileText(fileId, fileContent);
    return transactionId;
  }

  async approveAllowance(spenderAccountId, amount, isTestNegative = false) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnApproveAllowanceTransaction();
    if (isTestNegative) {
      await this.fill(this.allowanceOwnerAccountSelector, '0.0.999');
    } else {
      await this.fillInAllowanceOwnerAccount();
    }
    await this.fillInAllowanceAmount(amount);
    await this.fillInSpenderAccountId(spenderAccountId);
    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();
    await this.waitForCreatedAtToBeVisible();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnTransactionsMenuButton();
    return transactionId;
  }

  async transferAmountBetweenAccounts(toAccountId, amount, options = {}) {
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

    await this.clickOnSignAndSubmitButton();
    await this.clickSignTransactionButton();

    if (isSupposedToFail) {
      return null;
    } else {
      await this.waitForCreatedAtToBeVisible();
      const transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
      return transactionId;
    }
  }

  async clickOnReceiverSigRequiredSwitch() {
    await this.toggleSwitch(this.receiverSigRequiredSwitchSelector);
  }

  async clickONReceiverSigRequiredSwitchForUpdate() {
    await this.toggleSwitch(this.receiverSigRequiredSwitchForUpdateSelector);
  }

  async isReceiverSigRequiredSwitchToggledOn() {
    return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchSelector);
  }

  async isReceiverSigRequiredSwitchToggledOnForUpdatePage() {
    return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchForUpdateSelector);
  }

  async clickOnAcceptStakingRewardsSwitch() {
    await this.toggleSwitch(this.acceptStakingRewardsSwitchSelector);
  }

  async isAcceptStakingRewardsSwitchToggledOn() {
    return await this.isSwitchToggledOn(this.acceptStakingRewardsSwitchSelector);
  }

  async fillInMemo(memo) {
    await this.fill(this.accountMemoInputSelector, memo);
  }

  async getMemoText() {
    return this.getTextFromInputField(this.accountMemoInputSelector);
  }

  async fillInInitialFunds(amount) {
    const getFilledBalance = async () =>
      this.getTextFromInputField(this.initialBalanceInputSelector);

    let filledBalance = await getFilledBalance();

    while (filledBalance !== amount) {
      await this.fill(this.initialBalanceInputSelector, amount);
      await new Promise(resolve => setTimeout(resolve, 1000));
      filledBalance = await getFilledBalance();
    }
  }

  async getInitialFundsValue() {
    return this.getTextFromInputField(this.initialBalanceInputSelector);
  }

  async fillInMaxAccountAssociations(amount) {
    await this.fill(this.maxAutoAssociationsInputSelector, amount);
  }

  async getFilledMaxAccountAssociations() {
    return this.getTextFromInputField(this.maxAutoAssociationsInputSelector);
  }

  async clickOnSignAndSubmitButton() {
    await this.click(this.signAndSubmitButtonSelector, null, 10000);
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
  }

  async clickOnCloseButtonForCompletedTransaction() {
    await this.click(this.closeCompletedTxButtonSelector);
  }

  async clickOnCancelTransaction() {
    await this.click(this.buttonCancelTransactionSelector);
  }

  async clickAddButton(depth) {
    await this.click(this.addComplexButtonIndex + depth);
  }

  async selectPublicKeyOption(depth) {
    await this.click(this.addPublicKeyButtonIndex + depth);
  }

  async selectAccountKeyOption(depth) {
    await this.click(this.addAccountButtonIndex + depth);
  }

  async selectThreshold(depth) {
    await this.click(this.selectThresholdNumberIndex + depth);
  }

  async fillInPublicKeyField(publicKey) {
    await this.fill(this.publicKeyComplexInputSelector, publicKey);
  }

  async clickInsertPublicKey() {
    await this.click(this.insertPublicKeyButtonSelector);
  }

  async clickOnCreateNewComplexKeyButton() {
    await this.click(this.spanCreateNewComplexKeyButtonSelector);
  }

  async clickOnComplexTab() {
    await this.click(this.complexTabSelector);
  }

  async clickOnDoneButton() {
    await this.click(this.doneComplexKeyButtonSelector);
  }

  async clickOnDoneButtonForComplexKeyCreation() {
    await this.click(this.doneComplexKeyButtonSelector, 0);
  }

  /**
   * Generalized function to fill in the account ID input field, remove the last character,
   * type it again to trigger UI updates, and retry until the target button is enabled.
   * @param {string} accountId - The account ID to be filled in.
   * @param {string} inputSelector - The test ID selector for the input field.
   * @param {string} buttonSelector - The test ID selector for the button to check.
   */
  async fillInAccountId(accountId, inputSelector, buttonSelector) {
    const maxRetries = 100; // Maximum number of retries before giving up
    let attempt = 0;

    while (attempt < maxRetries) {
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
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100 milliseconds

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
      this.signAndSubmitButtonSelector,
    );
  }

  async fillInUpdatedAccountId(accountId) {
    await this.fillInAccountId(
      accountId,
      this.updateAccountInputSelector,
      this.signAndSubmitButtonSelector,
    );
  }

  async fillInSpenderAccountId(accountId, buttonSelector = this.signAndSubmitButtonSelector) {
    await this.fillInAccountId(accountId, this.allowanceSpenderAccountSelector, buttonSelector);
  }

  async fillInSpenderAccountIdNormally(accountId) {
    await this.fill(this.allowanceSpenderAccountSelector, accountId);
  }

  async getSpenderAccountId() {
    return await this.getTextFromInputField(this.allowanceSpenderAccountSelector);
  }

  async fillInTransferAccountId() {
    const allAccountIdsText = await this.getTextWithRetry(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    console.log('First Account ID:', firstAccountId);
    const cleanAccountId = getCleanAccountId(firstAccountId);
    await this.fillAndVerify(this.transferAccountInputSelector, cleanAccountId);
    return firstAccountId;
  }

  async fillInTransferAccountIdNormally(accountId) {
    await this.fill(this.transferAccountInputSelector, accountId);
  }

  async getFirstAccountIdFromText(allAccountIds) {
    const accountIdsArray = allAccountIds.trim().split(' ');
    return accountIdsArray[0];
  }

  async getPayerAccountId() {
    const allAccountIdsText = await this.getText(this.payerDropdownSelector);
    return await this.getFirstAccountIdFromText(allAccountIdsText);
  }

  async addAccountsToList(accountId) {
    this.generatedAccounts.push(accountId);
  }

  async removeAccountFromList(accountId) {
    this.generatedAccounts = this.generatedAccounts.filter(id => id !== accountId);
  }

  async addGeneratedFile(fileId, text, publicKey) {
    this.generatedFiles[fileId] = { text, publicKey };
  }

  async getTextFromCache(fileId) {
    const file = this.generatedFiles[fileId];
    return file ? file.text : null;
  }

  async getPublicKeyFromFile(fileId) {
    const file = this.generatedFiles[fileId];
    return file ? file.publicKey : null;
  }

  async listGeneratedFileKeys() {
    return Object.keys(this.generatedFiles);
  }

  async getFirsFileIdFromCache() {
    const keys = await this.listGeneratedFileKeys();
    return keys.length > 0 ? keys[0] : null;
  }

  async isGeneratedFilesEmpty() {
    return Object.keys(this.generatedFiles).length === 0;
  }

  async updateFileText(fileId, newText) {
    if (this.generatedFiles[fileId]) {
      this.generatedFiles[fileId].text = newText;
    } else {
      throw new Error(`File with ID ${fileId} does not exist.`);
    }
  }

  async appendToFileText(fileId, textToAppend) {
    if (this.generatedFiles[fileId]) {
      this.generatedFiles[fileId].text += textToAppend;
    } else {
      throw new Error(`File with ID ${fileId} does not exist.`);
    }
  }

  async isAccountsListEmpty() {
    return this.generatedAccounts.length === 0;
  }

  async getFirstAccountFromList() {
    return this.generatedAccounts[0];
  }

  async fillInMaxAutoAssociations(amount) {
    await this.fill(this.maxAutoAssociationsUpdateInputSelector, amount);
  }

  async getFilledMaxAutoAssociationsOnUpdatePage() {
    return await this.getTextFromInputField(this.maxAutoAssociationsUpdateInputSelector);
  }

  async fillInMemoUpdate(memo) {
    await this.fill(this.memoUpdateInputSelector, memo);
  }

  async fillInUpdateAccountIdNormally(accountId) {
    await this.fill(this.updateAccountInputSelector, accountId);
  }

  async fillInDeleteAccountIdNormally(accountId) {
    await this.fill(this.deletedAccountInputSelector, accountId);
  }

  async getMemoTextOnUpdatePage() {
    return await this.getTextFromInputField(this.memoUpdateInputSelector);
  }

  async fillInTransactionMemoUpdate(memo) {
    await this.fill(this.transactionMemoInputSelector, memo);
  }

  async getTransactionMemoText() {
    return await this.getTextFromInputField(this.transactionMemoInputSelector);
  }

  async fillInNickname(nickname) {
    await this.fill(this.nicknameInputSelector, nickname);
  }

  async fillInTransferFromAccountId() {
    const allAccountIdsText = await this.getText(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fill(this.transferFromAccountIdInputSelector, firstAccountId);
    return firstAccountId;
  }

  async fillInTransferAmountFromAccount(amount) {
    await this.fill(this.transferAmountFromAccountInputSelector, amount);
  }

  async fillInTransferToAccountId(accountId) {
    await this.fill(this.transferToAccountIdInputSelector, accountId);
  }

  async fillInTransferAmountToAccount(amount) {
    await this.fill(this.transferAmountToAccountInputSelector, amount);
  }

  async clickOnAddTransferFromButton() {
    await this.click(this.addTransferFromButtonSelector);
  }

  async clickOnAddTransferToButton() {
    await this.click(this.addTransferToButtonSelector);
  }

  async clickOnAddRestButton() {
    await this.click(this.addRestButtonSelector);
  }

  async getHbarAmountValueForTwoAccounts() {
    return await this.getText(this.hbarAmountValueSelector);
  }

  async isSignAndSubmitButtonEnabled() {
    return await this.isButtonEnabled(this.signAndSubmitButtonSelector);
  }

  async fillInAllowanceOwnerAccount() {
    const allAccountIdsText = await this.getText(this.payerDropdownSelector);
    console.log('All Account IDs:', allAccountIdsText);
    const firstAccountId = getCleanAccountId(
      await this.getFirstAccountIdFromText(allAccountIdsText),
    );
    console.log('First Account ID:', firstAccountId);
    await this.fill(this.allowanceOwnerAccountSelector, firstAccountId);
    return firstAccountId;
  }

  async fillInAllowanceOwner(accountId) {
    await this.fill(this.allowanceOwnerAccountSelector, accountId);
  }

  async getAllowanceOwnerAccountId() {
    return await this.getTextFromInputField(this.allowanceOwnerAccountSelector);
  }

  async fillInAllowanceAmount(amount) {
    await this.fill(this.allowanceAmountSelector, amount);
  }

  async getAllowanceAmount() {
    return await this.getTextFromInputField(this.allowanceAmountSelector);
  }

  async isSignAndSubmitButtonVisible() {
    return await this.isElementVisible(this.signAndSubmitButtonSelector);
  }

  async isTransferAccountIdVisible() {
    return await this.isElementVisible(this.transferAccountInputSelector);
  }

  async getPrefilledAccountIdInUpdatePage() {
    return await this.getTextFromInputField(this.updateAccountInputSelector);
  }

  async getPrefilledAccountIdInDeletePage() {
    return await this.getTextFromInputField(this.deletedAccountInputSelector);
  }

  async getPrefilledTransferIdAccountInDeletePage() {
    return await this.getTextFromInputField(this.transferAccountInputSelector);
  }

  async fillInFileContent(fileContent) {
    await this.fill(this.fileContentTextFieldSelector, fileContent);
  }

  async clickOnFileServiceLink() {
    await this.click(this.fileServiceLinkSelector);
  }

  async fillInFileIdForRead(fileId) {
    await this.fill(this.fileIdInputForReadSelector, fileId);
  }

  async getFileIdFromReadPage() {
    return await this.getTextFromInputField(this.fileIdInputForReadSelector);
  }

  async readFileContentFromTextArea() {
    return await this.getTextFromInputFieldWithRetry(this.fileContentReadTextFieldSelector);
  }

  async getPublicKeyText() {
    return await this.getTextFromInputFieldWithRetry(this.publicKeyInputSelector, 1);
  }

  async fillInFileIdForUpdate(fileId) {
    await this.fill(this.fileIdUpdateInputSelector, fileId);
  }

  async getFileIdFromUpdatePage() {
    return await this.getTextFromInputField(this.fileIdUpdateInputSelector);
  }

  async fillInPublicKeyForFile(publicKey) {
    await this.fill(this.publicKeyInputSelector, publicKey, 1);
  }

  async fillInFileContentForUpdate(fileContent) {
    await this.fill(this.fileContentUpdateTextFieldSelector, fileContent);
  }

  async fillInFileIdForAppend(fileId) {
    await this.fill(this.fileIdInputForAppendSelector, fileId);
  }

  async getFileIdFromAppendPage() {
    return await this.getTextFromInputField(this.fileIdInputForAppendSelector);
  }

  async fillInFileContentForAppend(fileContent) {
    await this.fill(this.fileContentAppendTextFieldSelector, fileContent);
  }

  async getTransactionTypeHeaderText() {
    return await this.getText(this.transactionTypeHeaderSelector);
  }

  async clickOnSaveDraftButton() {
    await this.click(this.saveDraftButtonSelector);
  }

  async clickOnDraftsMenuButton() {
    await this.click(this.draftsTabSelector);
  }

  async fillInTransactionMemoForApprovePage(memo) {
    await this.fill(this.approveAllowanceTransactionMemoSelector, memo);
  }

  async getTransactionMemoFromApprovePage() {
    return await this.getTextFromInputField(this.approveAllowanceTransactionMemoSelector);
  }

  async fillInFileMemo(memo) {
    await this.fill(this.fileMemoInputSelector, memo);
  }

  async getFileMemoTextFromField() {
    return await this.getTextFromInputField(this.fileMemoInputSelector);
  }

  async getFirstDraftDate() {
    return await this.getText(this.draftDetailsDateIndexSelector + '0');
  }

  async getFirstDraftType() {
    return await this.getText(this.draftDetailsTypeIndexSelector + '0');
  }

  async getFirstDraftIsTemplateCheckboxVisible() {
    return await this.isElementVisible(this.draftDetailsIsTemplateCheckboxSelector + '0');
  }

  async clickOnFirstDraftIsTemplateCheckbox() {
    await this.click(this.draftDetailsIsTemplateCheckboxSelector + '0');
  }

  async clickOnFirstDraftDeleteButton() {
    await this.click(this.draftDeleteButtonIndexSelector + '0');
  }

  async isFirstDraftDeleteButtonVisible() {
    return await this.isElementVisible(this.draftDeleteButtonIndexSelector + '0');
  }

  async clickOnFirstDraftContinueButton() {
    await this.click(this.draftContinueButtonIndexSelector + '0');
  }

  async isFirstDraftContinueButtonVisible() {
    return await this.isElementVisible(this.draftContinueButtonIndexSelector + '0');
  }

  async saveDraft() {
    await this.clickOnSaveDraftButton();
    await this.clickOnTransactionsMenuButton();
    await this.closeDraftModal();
    await this.clickOnDraftsMenuButton();
  }

  async deleteFirstDraft() {
    await this.clickOnFirstDraftDeleteButton();
    await this.waitForElementToDisappear(this.toastMessageSelector);
  }

  async navigateToDrafts() {
    await this.clickOnTransactionsMenuButton();
    await this.closeDraftModal();
    await this.clickOnDraftsMenuButton();
  }

  async waitForPublicKeyToBeFilled() {
    await this.waitForInputFieldToBeFilled(this.publicKeyInputSelector, 1);
  }

  async turnReceiverSigSwitchOn() {
    const maxAttempts = 10;
    const interval = 500;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const isToggledOn = await this.isReceiverSigRequiredSwitchToggledOnForUpdatePage();
      if (isToggledOn) {
        console.log(`Receiver signature switch is turned on.`);
        return; // Exit the function if the switch is toggled on
      } else {
        console.log(`Attempt ${attempts + 1}: Receiver signature switch is off, toggling it on...`);
        await this.clickONReceiverSigRequiredSwitchForUpdate();
        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error('Failed to turn the receiver signature switch on after multiple attempts');
  }

  async clickOnConfirmDeleteAccountButton() {
    await this.waitForElementPresentInDOM(this.confirmDeleteAccountButtonSelector);
    await this.click(this.confirmDeleteAccountButtonSelector, null, 5000);
  }

  async getMaxTransactionFee() {
    return await this.getTextFromInputField(this.maxTransactionFeeInputSelector);
  }

  async fillInDescription(description) {
    await this.fill(this.descriptionInputSelector, description);
  }

  async uploadSystemFile(fileName) {
    const filePath = path.resolve(__dirname, '..', 'data', fileName);
    await this.uploadFile(this.uploadFileButtonSelector, filePath);
  }

  async fillInPayerAccountId(accountId) {
    await this.fill(this.payerDropdownSelector, accountId);
  }

  async fillInComplexAccountID(accountId) {
    await this.fill(this.complexKeyAccountIdInputSelector, accountId);
  }

  async clickOnInsertAccountIdButton() {
    await this.click(this.insertAccountIdButtonSelector);
  }
}
module.exports = TransactionPage;
