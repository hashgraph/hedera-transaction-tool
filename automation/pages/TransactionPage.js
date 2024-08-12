const BasePage = require('./BasePage');
const { getAccountDetails, getTransactionDetails } = require('../utils/mirrorNodeAPI');
const {
  verifyTransactionExists,
  verifyAccountExists,
  verifyFileExists,
} = require('../utils/databaseQueries');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');

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
  maxAutoAssociationsInputSelector = 'input-max-auto-associations';
  accountMemoInputSelector = 'input-account-memo';
  nicknameInputSelector = 'input-nickname';
  publicKeyComplexInputSelector = 'input-complex-public-key';
  deletedAccountInputSelector = 'input-delete-account-id';
  transferAccountInputSelector = 'input-transfer-account-id';
  updateAccountInputSelector = 'input-account-id-for-update';
  maxAutoAssociationsUpdateInputSelector = 'input-max-auto-token-associations';
  memoUpdateInputSelector = 'input-memo-update';
  transactionMemoUpdateInputSelector = 'input-transaction-memo';
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
  fileContentUpdateTextFieldSelector = 'textarea-update-file-content';
  fileIdInputForAppendSelector = 'input-file-id-append';
  fileContentAppendTextFieldSelector = 'textarea-file-content-for-append';
  fileCreateTransactionMemoInputSelector = 'input-transaction-memo-for-file-create';
  fileUpdateTransactionMemoInputSelector = 'input-transaction-memo-for-file-update';
  fileAppendTransactionMemoInputSelector = 'input-transaction-memo-for-file-append';
  fileCreateMemoInputSelector = 'input-memo-for-file-create';
  fileCreateExpirationDateInputSelector = 'input-expiration-time-for-file';
  fileCreateNameInputSelector = 'input-file-name-for-file-create';
  fileCreateDescriptionInputSelector = 'input-file-description-for-file-create';
  deleteAccountMemoInputSelector = 'input-delete-account-memo';
  fileUpdateMemoInputSelector = 'input-file-update-memo';

  //Buttons
  transactionsMenuButtonSelector = 'button-menu-transactions';
  accountsMenuButtonSelector = 'button-menu-accounts';
  createNewTransactionButtonSelector = 'button-create-new';
  createAccountSublinkSelector = 'menu-sublink-0';
  updateAccountSublinkSelector = 'menu-sublink-1';
  transferTokensSublinkSelector = 'menu-sublink-2';
  deleteAccountSublinkSelector = 'menu-sublink-3';
  allowanceSublinkSelector = 'menu-sublink-4';
  fileServiceLinkSelector = 'menu-link-1';
  createFileSublinkSelector = 'menu-sublink-0';
  updateFileSublinkSelector = 'menu-sublink-1';
  readFileSublinkSelector = 'menu-sublink-2';
  appendFileSublinkSelector = 'menu-sublink-3';
  saveDraftButtonSelector = 'button-save-draft';
  signAndSubmitButtonSelector = 'button-sign-and-submit';
  signAndSubmitDeleteButtonSelector = 'button-sign-and-submit-delete';
  signAndSubmitUpdateButtonSelector = 'button-sign-and-submit-update';
  payerDropdownSelector = 'dropdown-payer';
  singleTabSelector = 'tab-single';
  complexTabSelector = 'tab-complex';
  receiverSigRequiredSwitchSelector = 'switch-receiver-sig-required';
  receiverSigRequiredSwitchForUpdateSelector = 'switch-receiver-sig-required-for-update';
  acceptStakingRewardsSwitchSelector = 'switch-accept-staking-rewards';
  discardModalDraftButtonSelector = 'button-discard-draft-modal';
  buttonSignTransactionSelector = 'button-sign-transaction';
  buttonCancelTransactionSelector = 'button-cancel-transaction';
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
  signAndSubmitFileCreateSelector = 'button-sign-and-submit-file-create';
  signAndReadFileButtonSelector = 'button-sign-and-read-file';
  signAndSubmitUpdateFileSelector = 'button-sign-and-submit-update-file';
  signAndSubmitFileAppendButtonSelector = 'button-sign-and-submit-file-append';
  draftsTabSelector = 'tab-0';
  draftDeleteButtonIndexSelector = 'button-draft-delete-';
  draftContinueButtonIndexSelector = 'button-draft-continue-';
  confirmDeleteAccountButtonSelector = 'button-confirm-delete-account';
  singleTransactionButtonSelector = 'span-single-transaction';

  //Other
  modalTransactionSuccessSelector = 'modal-transaction-success';
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
  approveAllowanceTransactionMemoSelector = 'input-transaction-memo-for-approve-allowance';
  newAccountIdDetailsSelector = 'p-new-account-id';

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
      this.isElementVisible(this.signAndSubmitFileCreateSelector),
      this.isElementVisible(this.fileContentTextFieldSelector),
      this.isElementVisible(this.fileCreateTransactionMemoInputSelector),
      this.isElementVisible(this.fileCreateMemoInputSelector),
      this.isElementVisible(this.fileCreateExpirationDateInputSelector),
      this.isElementVisible(this.fileCreateNameInputSelector),
      this.isElementVisible(this.fileCreateDescriptionInputSelector),
      this.isElementVisible(this.fileContentTextFieldSelector),
      this.isElementVisible(this.signAndSubmitFileCreateSelector),
    ]);
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
    await this.clickByTestId(this.transactionsMenuButtonSelector, 2500);
  }

  async clickOnSingleTransactionButton() {
    await this.clickByTestId(this.singleTransactionButtonSelector);
  }

  async clickOnAccountsMenuButton() {
    await this.clickByTestId(this.accountsMenuButtonSelector);
  }

  async clickOnCreateNewTransactionButton() {
    await this.clickByTestId(this.createNewTransactionButtonSelector);
    await this.clickOnSingleTransactionButton();
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

  async clickOnMenuLink(linkSelector, activeClass, transactionType) {
    console.log(`Attempting to click on ${transactionType} menu link`);
    const maxAttempts = 10; // Maximum number of attempts to find the correct element
    for (let index = 0; index < maxAttempts; index++) {
      try {
        await this.clickByTestIdWithIndex(linkSelector, index);
        return;
      } catch (error) {
        console.log(
          `Attempt ${index + 1}: Failed to find or click on the correct element, retrying...`,
        );
      }
    }
    throw new Error(`Failed to activate the ${transactionType} menu link after multiple attempts`);
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

  async clickOnFileCreateTransaction() {
    await this.clickOnTransactionLink(
      this.createFileSublinkSelector,
      this.signAndSubmitFileCreateSelector,
      'Create File',
    );
  }

  async clickOnReadCreateTransaction() {
    await this.clickOnTransactionLink(
      this.readFileSublinkSelector,
      this.signAndReadFileButtonSelector,
      'Read File',
    );
  }

  async clickOnUpdateFileSublink() {
    await this.clickOnTransactionLink(
      this.updateFileSublinkSelector,
      this.signAndSubmitUpdateFileSelector,
      'Update File',
    );
  }

  async clickOnAppendFileSublink() {
    await this.clickOnTransactionLink(
      this.appendFileSublinkSelector,
      this.signAndSubmitFileAppendButtonSelector,
      'Append File',
    );
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
    await this.clickOnSignAndSubmitDeleteButton();
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
    await this.clickOnSignAndSubmitUpdateButton();
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
    return await this.getTextByTestId(this.transactionDetailsIdSelector);
  }

  async createFile(fileContent) {
    await this.clickOnTransactionsMenuButton();
    await this.clickOnCreateNewTransactionButton();
    await this.clickOnFileServiceLink();
    await this.clickOnFileCreateTransaction();
    const publicKey = await this.getPublicKeyText();
    await this.fillInFileContent(fileContent);
    await this.clickOnSignAndSubmitFileCreateButton();
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
    await this.clickOnSignAndReadFileButton();
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
    await this.clickOnSignAndSubmitUpdateFileButton();
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
    await this.clickOnSignAndSubmitFileAppendButton();
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
      await this.fillByTestId(this.allowanceOwnerAccountSelector, '0.0.999');
    } else {
      await this.fillInAllowanceOwnerAccount();
    }
    await this.fillInAllowanceAmount(amount);
    await this.fillInSpenderAccountId(spenderAccountId);
    await this.clickOnSignAndSubmitAllowanceButton();
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

    await this.clickOnSignAndSubmitTransferButton();
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
    await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchSelector);
  }

  async clickONReceiverSigRequiredSwitchForUpdate() {
    await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchForUpdateSelector);
  }

  async isReceiverSigRequiredSwitchToggledOn() {
    return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchSelector);
  }

  async isReceiverSigRequiredSwitchToggledOnForUpdatePage() {
    return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchForUpdateSelector);
  }

  async clickOnAcceptStakingRewardsSwitch() {
    await this.toggleSwitchByTestId(this.acceptStakingRewardsSwitchSelector);
  }

  async isAcceptStakingRewardsSwitchToggledOn() {
    return await this.isSwitchToggledOn(this.acceptStakingRewardsSwitchSelector);
  }

  async fillInMemo(memo) {
    await this.fillByTestId(this.accountMemoInputSelector, memo);
  }

  async getMemoText() {
    return this.getTextFromInputFieldByTestId(this.accountMemoInputSelector);
  }

  async fillInInitialFunds(amount) {
    const { delay } = await import('../utils/util.js');
    const getFilledBalance = async () =>
      this.getTextFromInputFieldByTestId(this.initialBalanceInputSelector);

    let filledBalance = await getFilledBalance();

    while (filledBalance !== amount) {
      await this.fillByTestId(this.initialBalanceInputSelector, amount);
      await delay(1000);
      filledBalance = await getFilledBalance();
    }
  }

  async getInitialFundsValue() {
    return this.getTextFromInputFieldByTestId(this.initialBalanceInputSelector);
  }

  async fillInMaxAccountAssociations(amount) {
    await this.fillByTestId(this.maxAutoAssociationsInputSelector, amount);
  }

  async getFilledMaxAccountAssociations() {
    return this.getTextFromInputFieldByTestId(this.maxAutoAssociationsInputSelector);
  }

  async clickOnSignAndSubmitButton() {
    await this.clickByTestId(this.signAndSubmitButtonSelector, 10000);
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
  }

  async clickOnCloseButtonForCompletedTransaction() {
    await this.clickByTestId(this.closeCompletedTxButtonSelector);
  }

  async clickOnCancelTransaction() {
    await this.clickByTestId(this.buttonCancelTransactionSelector);
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

  async clickOnDoneButtonForComplexKeyCreation() {
    await this.clickByTestIdWithIndex(this.doneComplexKeyButtonSelector, 0);
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

  async fillInSpenderAccountIdNormally(accountId) {
    await this.fillByTestId(this.allowanceSpenderAccountSelector, accountId);
  }

  async getSpenderAccountId() {
    return await this.getTextFromInputFieldByTestId(this.allowanceSpenderAccountSelector);
  }

  async fillInTransferAccountId() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fillByTestId(this.transferAccountInputSelector, firstAccountId);
    return firstAccountId;
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
    await this.fillByTestId(this.maxAutoAssociationsUpdateInputSelector, amount);
  }

  async getFilledMaxAutoAssociationsOnUpdatePage() {
    return await this.getTextFromInputFieldByTestId(this.maxAutoAssociationsUpdateInputSelector);
  }

  async fillInMemoUpdate(memo) {
    await this.fillByTestId(this.memoUpdateInputSelector, memo);
  }

  async fillInUpdateAccountIdNormally(accountId) {
    await this.fillByTestId(this.updateAccountInputSelector, accountId);
  }

  async fillInDeleteAccountIdNormally(accountId) {
    await this.fillByTestId(this.deletedAccountInputSelector, accountId);
  }

  async getMemoTextOnUpdatePage() {
    return await this.getTextFromInputFieldByTestId(this.memoUpdateInputSelector);
  }

  async fillInTransactionMemoUpdate(memo) {
    await this.fillByTestId(this.transactionMemoUpdateInputSelector, memo);
  }

  async getTransactionMemoText() {
    return await this.getTextFromInputFieldByTestId(this.transactionMemoUpdateInputSelector);
  }

  async getTransactionMemoTextForDeletePage() {
    return await this.getTextFromInputFieldByTestId(this.deleteAccountMemoInputSelector);
  }

  async fillInNickname(nickname) {
    await this.fillByTestId(this.nicknameInputSelector, nickname);
  }

  async fillInTransferFromAccountId() {
    const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
    const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
    await this.fillByTestId(this.transferFromAccountIdInputSelector, firstAccountId);
    return firstAccountId;
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
    return firstAccountId;
  }

  async getAllowanceOwnerAccountId() {
    return await this.getTextFromInputFieldByTestId(this.allowanceOwnerAccountSelector);
  }

  async fillInAllowanceAmount(amount) {
    await this.fillByTestId(this.allowanceAmountSelector, amount);
  }

  async getAllowanceAmount() {
    return await this.getTextFromInputFieldByTestId(this.allowanceAmountSelector);
  }

  async clickOnSignAndSubmitAllowanceButton() {
    await this.clickByTestId(this.signAndSubmitAllowanceSelector);
  }

  async isSignAndSubmitCreateAccountButtonVisible() {
    return await this.isElementVisible(this.signAndSubmitButtonSelector);
  }

  async isSignAndSubmitUpdateAccountButtonVisible() {
    return await this.isElementVisible(this.signAndSubmitUpdateButtonSelector);
  }

  async isTransferAccountIdVisible() {
    return await this.isElementVisible(this.transferAccountInputSelector);
  }

  async getPrefilledAccountIdInUpdatePage() {
    return await this.getTextFromInputFieldByTestId(this.updateAccountInputSelector);
  }

  async getPrefilledAccountIdInDeletePage() {
    return await this.getTextFromInputFieldByTestId(this.deletedAccountInputSelector);
  }

  async getPrefilledTransferIdAccountInDeletePage() {
    return await this.getTextFromInputFieldByTestId(this.transferAccountInputSelector);
  }

  async fillInFileContent(fileContent) {
    await this.fillByTestId(this.fileContentTextFieldSelector, fileContent);
  }

  async getFileContentText() {
    return await this.getTextFromInputFieldByTestId(this.fileContentTextFieldSelector);
  }

  async clickOnSignAndSubmitFileCreateButton() {
    await this.clickByTestId(this.signAndSubmitFileCreateSelector, 10000);
  }

  async clickOnFileServiceLink() {
    await this.clickOnMenuLink(this.fileServiceLinkSelector, 'active', 'File Service');
  }

  async fillInFileIdForRead(fileId) {
    await this.fillByTestId(this.fileIdInputForReadSelector, fileId);
  }

  async getFileIdFromReadPage() {
    return await this.getTextFromInputFieldByTestId(this.fileIdInputForReadSelector);
  }

  async readFileContentFromTextArea() {
    return await this.getTextFromInputFieldByTestId(this.fileContentReadTextFieldSelector);
  }

  async clickOnSignAndReadFileButton() {
    await this.clickByTestId(this.signAndReadFileButtonSelector);
  }

  async getPublicKeyText() {
    return await this.getTextFromInputFieldByTestIdWithIndex(this.publicKeyInputSelector);
  }

  async fillInFileIdForUpdate(fileId) {
    await this.fillByTestId(this.fileIdUpdateInputSelector, fileId);
  }

  async getFileIdFromUpdatePage() {
    return await this.getTextFromInputFieldByTestId(this.fileIdUpdateInputSelector);
  }

  async fillInPublicKeyForFile(publicKey) {
    await this.fillByTestIdWithIndex(this.publicKeyInputSelector, publicKey);
  }

  async fillInFileContentForUpdate(fileContent) {
    await this.fillByTestId(this.fileContentUpdateTextFieldSelector, fileContent);
  }

  async clickOnSignAndSubmitUpdateFileButton() {
    await this.clickByTestId(this.signAndSubmitUpdateFileSelector);
  }

  async clickOnSignAndSubmitFileAppendButton() {
    await this.clickByTestId(this.signAndSubmitFileAppendButtonSelector);
  }

  async fillInFileIdForAppend(fileId) {
    await this.fillByTestId(this.fileIdInputForAppendSelector, fileId);
  }

  async getFileIdFromAppendPage() {
    return await this.getTextFromInputFieldByTestId(this.fileIdInputForAppendSelector);
  }

  async fillInFileContentForAppend(fileContent) {
    await this.fillByTestId(this.fileContentAppendTextFieldSelector, fileContent);
  }

  async getTransactionTypeHeaderText() {
    return await this.getTextByTestId(this.transactionTypeHeaderSelector);
  }

  async clickOnSaveDraftButton() {
    await this.clickByTestId(this.saveDraftButtonSelector);
  }

  async clickOnDraftsMenuButton() {
    await this.clickByTestId(this.draftsTabSelector);
  }

  async fillInDeleteAccountTransactionMemo(memo) {
    await this.fillByTestId(this.deleteAccountMemoInputSelector, memo);
  }

  async fillInTransactionMemoForApprovePage(memo) {
    await this.fillByTestId(this.approveAllowanceTransactionMemoSelector, memo);
  }

  async getTransactionMemoFromApprovePage() {
    return await this.getTextFromInputFieldByTestId(this.approveAllowanceTransactionMemoSelector);
  }

  async fillInTransactionMemoForCreateFilePage(memo) {
    await this.fillByTestId(this.fileCreateTransactionMemoInputSelector, memo);
  }

  async getTransactionMemoFromFilePage() {
    return await this.getTextFromInputFieldByTestId(this.fileCreateTransactionMemoInputSelector);
  }

  async fillInFileMemoForCreatePage(memo) {
    await this.fillByTestId(this.fileCreateMemoInputSelector, memo);
  }

  async getFileMemoFromCreatePage() {
    return await this.getTextFromInputFieldByTestId(this.fileCreateMemoInputSelector);
  }

  async fillInTransactionMemoForFileUpdatePage(memo) {
    await this.fillByTestId(this.fileUpdateTransactionMemoInputSelector, memo);
  }

  async getTransactionMemoFromFileUpdatePage() {
    return await this.getTextFromInputFieldByTestId(this.fileUpdateTransactionMemoInputSelector);
  }

  async fillInTransactionMemoForFileAppendPage(memo) {
    await this.fillByTestId(this.fileAppendTransactionMemoInputSelector, memo);
  }

  async getTransactionMemoFromFileAppendPage() {
    return await this.getTextFromInputFieldByTestId(this.fileAppendTransactionMemoInputSelector);
  }

  async fillInFileUpdateMemo(memo) {
    await this.fillByTestId(this.fileUpdateMemoInputSelector, memo);
  }

  async getFileUpdateMemo() {
    return await this.getTextFromInputFieldByTestId(this.fileUpdateMemoInputSelector);
  }

  async getFirstDraftDate() {
    return await this.getTextByTestId(this.draftDetailsDateIndexSelector + '0');
  }

  async getFirstDraftType() {
    return await this.getTextByTestId(this.draftDetailsTypeIndexSelector + '0');
  }

  async getFirstDraftIsTemplateCheckboxVisible() {
    return await this.isElementVisible(this.draftDetailsIsTemplateCheckboxSelector + '0');
  }

  async clickOnFirstDraftIsTemplateCheckbox() {
    await this.clickByTestId(this.draftDetailsIsTemplateCheckboxSelector + '0');
  }

  async clickOnFirstDraftDeleteButton() {
    await this.clickByTestId(this.draftDeleteButtonIndexSelector + '0');
  }

  async isFirstDraftDeleteButtonVisible() {
    return await this.isElementVisible(this.draftDeleteButtonIndexSelector + '0');
  }

  async clickOnFirstDraftContinueButton() {
    await this.clickByTestId(this.draftContinueButtonIndexSelector + '0');
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
    await this.clickByTestId(this.confirmDeleteAccountButtonSelector);
  }
}
module.exports = TransactionPage;
