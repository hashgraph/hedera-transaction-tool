const BasePage = require('./BasePage');
const { getAccountDetails, getTransactionDetails } = require('../utils/mirrorNodeAPI');
const { queryDatabase } = require('../utils/databaseUtil');
const { decodeAndFlattenKeys } = require('../utils/keyUtil');
import { allure } from 'allure-playwright';

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
  passwordSignTransactionInputSelector = 'input-password-transaction';
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
  signPasswordForReadInputFieldSelector = 'input-password-for-sign-query';
  publicKeyInputSelector = 'input-public-key';
  fileIdUpdateInputSelector = 'input-file-id-for-update';
  fileContentUpdateTextFieldSelector = 'textarea-update-file-content';
  signPasswordForFileUpdateInputSelector = 'input-password-sign-file-update';
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
  signAndSubmitFileCreateSelector = 'button-sign-and-submit-file-create';
  signAndReadFileButtonSelector = 'button-sign-and-read-file';
  signReadQueryButtonSelector = 'button-sign-read-query';
  signAndSubmitUpdateFileSelector = 'button-sign-and-submit-update-file';
  signFileUpdateButtonSelector = 'button-sign-file-update';
  continueSignFileUpdateButtonSelector = 'button-continue-sign-file-update-transaction';
  signAndSubmitFileAppendButtonSelector = 'button-sign-and-submit-file-append';
  draftsTabSelector = 'tab-0';
  draftDeleteButtonIndexSelector = 'button-draft-delete-';
  draftContinueButtonIndexSelector = 'button-draft-continue-';

  //Other
  modalTransactionSuccessSelector = 'modal-transaction-success';
  confirmTransactionModalSelector = 'modal-confirm-transaction';
  spanCreateNewComplexKeyButtonSelector = 'span-create-new-complex-key';
  updateAccountIdFetchedDivSelector = 'div-account-info-fetched';

  //Messages
  textTypeTransactionSelector = 'p-type-transaction';
  textTransactionIdSelector = 'p-transaction-id';
  textMaxTxFeeSelector = 'p-max-tx-fee';
  accountIdPrefixSelector = 'p-account-id-';
  toastMessageSelector = '.v-toast__text';
  hbarAmountValueSelector = 'p-hbar-amount';
  transactionTypeHeaderSelector = 'h2-transaction-type';
  transactionDetailsCreatedAtSelector = 'p-transaction-details-created-at';
  transactionDetailsIdSelector = 'p-transaction-details-id';
  approveAllowanceTransactionMemoSelector = 'input-transaction-memo-for-approve-allowance';
  newAccountIdDetailsSelector = 'p-new-account-id';
  transactionStatusIndexSelector = 'td-transaction-status-';
  draftDetailsDateIndexSelector = 'span-draft-tx-date-';
  draftDetailsTypeIndexSelector = 'span-draft-tx-type-';
  draftDetailsIsTemplateCheckboxSelector = 'checkbox-is-template-';

  // Method to close the 'Save Draft' modal if it appears
  async closeDraftModal() {
    return await allure.step('Close Draft Modal', async () => {
      const modalButton = this.window.getByTestId(this.discardModalDraftButtonSelector);
      await modalButton.waitFor({ state: 'visible', timeout: 100 }).catch(e => {});

      if (await modalButton.isVisible()) {
        await modalButton.click();
      }
    });
  }

  // Combined method to verify all elements on Create transaction page
  async verifyAccountCreateTransactionElements() {
    return await allure.step('Verify Account Create Transaction Elements', async () => {
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

      return checks.every(isTrue => isTrue);
    });
  }

  async verifyFileCreateTransactionElements() {
    return await allure.step('Verify File Create Transaction Elements', async () => {
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
    });
  }

  async verifyConfirmTransactionInformation(typeTransaction) {
    return await allure.step('Verify Confirm Transaction Information', async () => {
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
    });
  }

  async mirrorGetAccountResponse(accountId) {
    let accountDetails;
    await allure.step('Execute Mirror node Accounts API call', async () => {
      accountDetails = await getAccountDetails(accountId);
      console.log('Account Details:', accountDetails);
    });
    return accountDetails;
  }

  async mirrorGetTransactionResponse(transactionId) {
    let transactionDetails;
    await allure.step('Execute Mirror node Transactions API call', async () => {
      transactionDetails = await getTransactionDetails(transactionId);
      if (transactionDetails.transactions.length > 0) {
        console.log('Transaction Details:', transactionDetails.transactions[0]);
      } else {
        console.log('Transaction not found in mirror node');
      }
    });
    return transactionDetails;
  }

  async closeCompletedTransaction() {
    return await allure.step('Close Completed Transaction', async () => {
      const isCompletedTxModalVisible = await this.isElementVisible(
        this.modalTransactionSuccessSelector,
      );
      if (isCompletedTxModalVisible) {
        await this.clickOnCloseButtonForCompletedTransaction();
      }
    });
  }

  async clickOnTransactionsMenuButton() {
    return await allure.step('Click On Transactions Menu Button', async () => {
      await this.clickByTestId(this.transactionsMenuButtonSelector);
    });
  }

  async clickOnAccountsMenuButton() {
    return await allure.step('Click On Accounts Menu Button', async () => {
      await this.clickByTestId(this.accountsMenuButtonSelector);
    });
  }

  async clickOnCreateNewTransactionButton() {
    return await allure.step('Click On Create New Transaction Button', async () => {
      await this.clickByTestId(this.createNewTransactionButtonSelector);
    });
  }

  async clickOnTransactionLink(linkSelector, targetSelector, transactionType) {
    await allure.step(`Click On ${transactionType} Transaction Link`, async () => {
      const maxAttempts = 10;
      for (let index = 0; index < maxAttempts; index++) {
        try {
          await this.clickByTestIdWithIndex(linkSelector, index);
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
    });
  }

  async clickOnMenuLink(linkSelector, activeClass, transactionType) {
    await allure.step(`Click On ${transactionType} Menu Link`, async () => {
      const maxAttempts = 10;
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
      throw new Error(
        `Failed to activate the ${transactionType} menu link after multiple attempts`,
      );
    });
  }

  async clickOnCreateAccountTransaction() {
    return await allure.step('Click On Create Account Transaction', async () => {
      await this.clickOnTransactionLink(
        this.createAccountSublinkSelector,
        this.signAndSubmitButtonSelector,
        'Create Account',
      );
    });
  }

  async clickOnDeleteAccountTransaction() {
    return await allure.step('Click On Delete Account Transaction', async () => {
      await this.clickOnTransactionLink(
        this.deleteAccountSublinkSelector,
        this.transferAccountInputSelector,
        'Delete Account',
      );
    });
  }

  async clickOnUpdateAccountTransaction() {
    return await allure.step('Click On Update Account Transaction', async () => {
      await this.clickOnTransactionLink(
        this.updateAccountSublinkSelector,
        this.updateAccountInputSelector,
        'Update Account',
      );
    });
  }

  async clickOnApproveAllowanceTransaction() {
    return await allure.step('Click On Approve Allowance Transaction', async () => {
      await this.clickOnTransactionLink(
        this.allowanceSublinkSelector,
        this.signAndSubmitAllowanceSelector,
        'Approve Allowance',
      );
    });
  }

  async clickOnTransferTokensTransaction() {
    return await allure.step('Click On Transfer Tokens Transaction', async () => {
      await this.clickOnTransactionLink(
        this.transferTokensSublinkSelector,
        this.signAndSubmitTransferSelector,
        'Transfer Tokens',
      );
    });
  }

  async clickOnFileCreateTransaction() {
    return await allure.step('Click On File Create Transaction', async () => {
      await this.clickOnTransactionLink(
        this.createFileSublinkSelector,
        this.signAndSubmitFileCreateSelector,
        'Create File',
      );
    });
  }

  async clickOnReadCreateTransaction() {
    return await allure.step('Click On Read Create Transaction', async () => {
      await this.clickOnTransactionLink(
        this.readFileSublinkSelector,
        this.signAndReadFileButtonSelector,
        'Read File',
      );
    });
  }

  async clickOnUpdateFileSublink() {
    return await allure.step('Click On Update File Sublink', async () => {
      await this.clickOnTransactionLink(
        this.updateFileSublinkSelector,
        this.signAndSubmitUpdateFileSelector,
        'Update File',
      );
    });
  }

  async clickOnAppendFileSublink() {
    return await allure.step('Click On Append File Sublink', async () => {
      await this.clickOnTransactionLink(
        this.appendFileSublinkSelector,
        this.signAndSubmitFileAppendButtonSelector,
        'Append File',
      );
    });
  }

  async verifyTransactionExists(transactionId, transactionType) {
    return await allure.step('Verify Transaction Exists', async () => {
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
    });
  }

  async verifyAccountExists(accountId) {
    return await allure.step('Verify Account Exists', async () => {
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
    });
  }

  async verifyFileExists(fileId) {
    return await allure.step('Verify File Exists', async () => {
      const query = `
        SELECT COUNT(*) AS count
        FROM HederaFile
        WHERE file_id = ?`;

      try {
        const row = await queryDatabase(query, [fileId]);
        return row ? row.count > 0 : false;
      } catch (error) {
        console.error('Error verifying file:', error);
        return false;
      }
    });
  }

  async addPublicKeyAtDepth(depth) {
    return await allure.step(`Add Public Key At Depth ${depth}`, async () => {
      await this.clickAddButton(depth);
      await this.selectPublicKeyOption(depth);
      const publicKey = await this.generateRandomPublicKey();
      await this.fillInPublicKeyField(publicKey);
      await this.clickInsertPublicKey();
    });
  }

  async addThresholdKeyAtDepth(depth) {
    return await allure.step(`Add Threshold Key At Depth ${depth}`, async () => {
      await this.clickAddButton(depth);
      await this.selectThreshold(depth);
    });
  }

  async createComplexKeyStructure() {
    return await allure.step('Create Complex Key Structure', async () => {
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
    });
  }

  async decodeByteCode(bytecode) {
    return await allure.step('Decode Byte Code', async () => {
      return decodeAndFlattenKeys(bytecode);
    });
  }

  getAllGeneratedPublicKeys() {
    return this.generatedPublicKeys;
  }

  async keysMatch(decodedKeys, generatedKeys) {
    return await allure.step('Match Keys', async () => {
      const sortedDecodedKeys = decodedKeys.map(key => key.toLowerCase()).sort();
      const sortedGeneratedKeys = generatedKeys.map(key => key.toLowerCase()).sort();

      if (sortedDecodedKeys.length !== sortedGeneratedKeys.length) {
        return false;
      }

      return sortedDecodedKeys.every((value, index) => value === sortedGeneratedKeys[index]);
    });
  }

  async generateRandomPublicKey() {
    return await allure.step('Generate Random Public Key', async () => {
      const header = '302a300506032b6570032100';
      const hexChars = '0123456789ABCDEF';
      let publicKey = '';
      for (let i = 0; i < 64; i++) {
        publicKey += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
      }
      const publicKeyWithPrefix = header + publicKey;
      this.generatedPublicKeys.push(publicKeyWithPrefix); // Store the generated public key
      return publicKey;
    });
  }

  async findAccountIndexById(accountId) {
    return await allure.step('Find Account Index By ID', async () => {
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
    });
  }

  async isAccountCardVisible(accountId) {
    return await allure.step('Check If Account Card Is Visible', async () => {
      await this.waitForElementToBeVisible(this.addNewAccountButtonSelector);
      const index = await this.findAccountIndexById(accountId);
      if (index === -1) {
        return false; // account not found
      } else {
        return await this.isElementVisible(this.accountIdPrefixSelector + index);
      }
    });
  }

  async ensureAccountExists(password) {
    return await allure.step('Ensure Account Exists', async () => {
      if (await this.isAccountsListEmpty()) {
        await this.createNewAccount(password);
      }
    });
  }

  async ensureFileExists(text, password) {
    return await allure.step('Ensure File Exists', async () => {
      if (await this.isGeneratedFilesEmpty()) {
        await this.createFile(text, password);
      }
    });
  }

  async createNewAccount(password, options = {}, isComingFromDraft = false) {
    let newAccountId, newTransactionId;
    await allure.step('Execute account create tx', async () => {
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
        {
          condition: isReceiverSigRequired,
          handler: () => this.clickOnReceiverSigRequiredSwitch(),
        },
        { condition: memo !== null, handler: () => this.fillInMemo(memo) },
      ];

      for (const { condition, handler } of optionHandlers) {
        if (condition) await handler();
      }

      await this.clickOnSignAndSubmitButton();
      await this.clickSignTransactionButton();
      await this.fillInPassword(password);
      await this.clickOnPasswordContinue();
      await this.waitForCreatedAtToBeVisible();

      newTransactionId = await this.getTransactionDetailsId();
      const transactionDetails = await this.mirrorGetTransactionResponse(newTransactionId);
      newAccountId = transactionDetails.transactions[0].entity_id;

      await this.clickOnTransactionsMenuButton();
      await this.addAccountsToList(newAccountId);
    });
    return { newAccountId, newTransactionId };
  }

  // Helper method for complex key creation
  async handleComplexKeyCreation() {
    return await allure.step('Handle Complex Key Creation', async () => {
      await this.clickOnComplexTab();
      await this.clickOnCreateNewComplexKeyButton();
      await this.createComplexKeyStructure();
      await this.clickOnDoneButton();
    });
  }

  async deleteAccount(accountId, password) {
    let transactionId;
    await allure.step('Delete Account', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnDeleteAccountTransaction();
      await this.fillInTransferAccountId();
      await this.fillInDeletedAccountId(accountId);
      await this.clickOnSignAndSubmitDeleteButton();
      await this.clickSignTransactionButton();
      await this.fillInPassword(password);
      await this.clickOnPasswordContinue();
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
      await this.removeAccountFromList(accountId);
    });
    return transactionId;
  }

  async updateAccount(accountId, password, maxAutoAssociations, memo) {
    let transactionId;
    await allure.step('Update Account', async () => {
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
      await this.fillInPassword(password);
      await this.clickOnPasswordContinue();
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
    });
    return transactionId;
  }

  async waitForCreatedAtToBeVisible() {
    return await allure.step('Wait For Created At To Be Visible', async () => {
      await this.waitForElementToBeVisible(this.transactionDetailsCreatedAtSelector, 25000);
    });
  }

  async getTransactionDetailsId() {
    return await allure.step('Get Transaction Details ID', async () => {
      return await this.getTextByTestId(this.transactionDetailsIdSelector);
    });
  }

  async createFile(fileContent, password) {
    let transactionId, fileId;
    await allure.step('Create File', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnFileServiceLink();
      await this.clickOnFileCreateTransaction();
      const publicKey = await this.getPublicKeyText();
      await this.fillInFileContent(fileContent);
      await this.clickOnSignAndSubmitFileCreateButton();
      await this.clickSignTransactionButton();
      await this.fillInPassword(password);
      await this.clickOnPasswordContinue();
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
      const transactionDetails = await this.mirrorGetTransactionResponse(transactionId);
      fileId = transactionDetails.transactions[0].entity_id;
      await this.addGeneratedFile(fileId, fileContent, publicKey);
    });
    return { transactionId, fileId };
  }

  async readFile(fileId, password) {
    let fileContent;
    await allure.step('Read File', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnFileServiceLink();
      await this.clickOnReadCreateTransaction();
      await this.fillInFileIdForRead(fileId);
      await this.clickOnSignAndReadFileButton();
      await this.fillInPasswordForRead(password);
      await this.clickOnSignReadQueryButton();
      await this.waitForElementToDisappear(this.toastMessageSelector);
      fileContent = await this.readFileContentFromTextArea();
    });
    return fileContent;
  }

  async updateFile(fileId, fileContent, password) {
    let transactionId;
    await allure.step('Update File', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnFileServiceLink();
      await this.clickOnUpdateFileSublink();
      await this.fillInFileIdForUpdate(fileId);
      const publicKey = await this.getPublicKeyFromFile(fileId);
      await this.fillInPublicKeyForFile(publicKey);
      await this.fillInFileContentForUpdate(fileContent);
      await this.clickOnSignAndSubmitUpdateFileButton();
      await this.clickOnSignFileButton();
      await this.fillInPasswordForFile(password);
      await this.clickOnContinueSignFileButton();
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
      await this.updateFileText(fileId, fileContent);
    });
    return transactionId;
  }

  async appendFile(fileId, fileContent, password) {
    let transactionId;
    await allure.step('Append File', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.clickOnCreateNewTransactionButton();
      await this.clickOnFileServiceLink();
      await this.clickOnAppendFileSublink();
      await this.fillInFileIdForAppend(fileId);
      const publicKey = await this.getPublicKeyFromFile(fileId);
      await this.fillInPublicKeyForFile(publicKey);
      await this.fillInFileContentForAppend(fileContent);
      await this.clickOnSignAndSubmitFileAppendButton();
      await this.clickOnSignFileButton();
      await this.fillInPasswordForFile(password);
      await this.clickOnContinueSignFileButton();
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
      await this.appendToFileText(fileId, fileContent);
    });
    return transactionId;
  }

  async approveAllowance(spenderAccountId, amount, password, isTestNegative = false) {
    let transactionId;
    await allure.step('Approve Allowance', async () => {
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
      await this.waitForCreatedAtToBeVisible();
      transactionId = await this.getTransactionDetailsId();
      await this.clickOnTransactionsMenuButton();
    });
    return transactionId;
  }

  async transferAmountBetweenAccounts(toAccountId, amount, password, options = {}) {
    const { isSupposedToFail = false } = options;
    let transactionId = null;

    await allure.step('Transfer Amount Between Accounts', async () => {
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

      if (!isSupposedToFail) {
        await this.waitForCreatedAtToBeVisible();
        transactionId = await this.getTransactionDetailsId();
        await this.clickOnTransactionsMenuButton();
      }
    });

    return transactionId;
  }

  async clickOnReceiverSigRequiredSwitch() {
    return await allure.step('Click On Receiver Signature Required Switch', async () => {
      await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchSelector);
    });
  }

  async clickONReceiverSigRequiredSwitchForUpdate() {
    return await allure.step('Click On Receiver Signature Required Switch For Update', async () => {
      await this.toggleSwitchByTestId(this.receiverSigRequiredSwitchForUpdateSelector);
    });
  }

  async isReceiverSigRequiredSwitchToggledOn() {
    return await allure.step('Is Receiver Signature Required Switch Toggled On', async () => {
      return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchSelector);
    });
  }

  async isReceiverSigRequiredSwitchToggledOnUpdatePage() {
    return await allure.step(
      'Is Receiver Signature Required Switch Toggled On Update Page',
      async () => {
        return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchForUpdateSelector);
      },
    );
  }

  async isReceiverSigRequiredSwitchToggledOnForUpdatePage() {
    return await allure.step(
      'Is Receiver Signature Required Switch Toggled On For Update Page',
      async () => {
        return await this.isSwitchToggledOn(this.receiverSigRequiredSwitchForUpdateSelector);
      },
    );
  }

  async clickOnAcceptStakingRewardsSwitch() {
    return await allure.step('Click On Accept Staking Rewards Switch', async () => {
      await this.toggleSwitchByTestId(this.acceptStakingRewardsSwitchSelector);
    });
  }

  async isAcceptStakingRewardsSwitchToggledOn() {
    return await allure.step('Is Accept Staking Rewards Switch Toggled On', async () => {
      return await this.isSwitchToggledOn(this.acceptStakingRewardsSwitchSelector);
    });
  }

  async fillInMemo(memo) {
    return await allure.step('Fill In Memo', async () => {
      await this.fillByTestId(this.accountMemoInputSelector, memo);
    });
  }

  async getMemoText() {
    return await allure.step('Get Memo Text', async () => {
      return this.getTextFromInputFieldByTestId(this.accountMemoInputSelector);
    });
  }

  async fillInInitialFunds(amount) {
    return await allure.step('Fill In Initial Funds', async () => {
      const { delay } = await import('../utils/util.js');
      const getFilledBalance = async () =>
        this.getTextFromInputFieldByTestId(this.initialBalanceInputSelector);

      let filledBalance = await getFilledBalance();

      while (filledBalance !== amount) {
        await this.fillByTestId(this.initialBalanceInputSelector, amount);
        await delay(1000);
        filledBalance = await getFilledBalance();
      }
    });
  }

  async getInitialFundsValue() {
    return await allure.step('Get Initial Funds Value', async () => {
      return this.getTextFromInputFieldByTestId(this.initialBalanceInputSelector);
    });
  }

  async fillInMaxAccountAssociations(amount) {
    return await allure.step('Fill In Max Account Associations', async () => {
      await this.fillByTestId(this.maxAutoAssociationsInputSelector, amount);
    });
  }

  async getFilledMaxAccountAssociations() {
    return await allure.step('Get Filled Max Account Associations', async () => {
      return this.getTextFromInputFieldByTestId(this.maxAutoAssociationsInputSelector);
    });
  }

  async clickOnSignAndSubmitButton() {
    return await allure.step('Click On Sign And Submit Button', async () => {
      await this.clickByTestId(this.signAndSubmitButtonSelector, 10000);
    });
  }

  async clickOnSignAndSubmitDeleteButton() {
    return await allure.step('Click On Sign And Submit Delete Button', async () => {
      await this.clickByTestId(this.signAndSubmitDeleteButtonSelector);
    });
  }

  async clickOnSignAndSubmitUpdateButton() {
    return await allure.step('Click On Sign And Submit Update Button', async () => {
      await this.clickByTestId(this.signAndSubmitUpdateButtonSelector);
    });
  }

  async clickSignTransactionButton() {
    return await allure.step('Click Sign Transaction Button', async () => {
      const modalSelector = `[data-testid="${this.confirmTransactionModalSelector}"][style*="display: block"]`;
      await this.window.waitForSelector(modalSelector, { state: 'visible', timeout: 15000 });

      const signButtonSelector = `${modalSelector} [data-testid="${this.buttonSignTransactionSelector}"]:enabled`;

      await this.window.waitForSelector(signButtonSelector, { state: 'visible', timeout: 15000 });
      await this.window.click(signButtonSelector);

      await this.waitForElementToBeVisible(this.passwordSignTransactionInputSelector);
    });
  }

  async clickOnPasswordContinue() {
    return await allure.step('Click On Password Continue', async () => {
      await this.clickByTestId(this.passwordContinueButtonSelector);
    });
  }

  async clickOnCloseButtonForCompletedTransaction() {
    return await allure.step('Click On Close Button For Completed Transaction', async () => {
      await this.clickByTestId(this.closeCompletedTxButtonSelector);
    });
  }

  async fillInPassword(password) {
    return await allure.step('Fill In Password', async () => {
      await this.fillByTestId(this.passwordSignTransactionInputSelector, password);
    });
  }

  async clickOnCancelTransaction() {
    return await allure.step('Click On Cancel Transaction', async () => {
      await this.clickByTestId(this.buttonCancelTransactionSelector);
    });
  }

  async clickAddButton(depth) {
    return await allure.step('Click Add Button', async () => {
      await this.clickByTestId(this.addComplexButtonIndex + depth);
    });
  }

  async selectPublicKeyOption(depth) {
    return await allure.step('Select Public Key Option', async () => {
      await this.clickByTestId(this.addPublicKeyButtonIndex + depth);
    });
  }

  async selectThreshold(depth) {
    return await allure.step('Select Threshold', async () => {
      await this.clickByTestId(this.selectThresholdNumberIndex + depth);
    });
  }

  async fillInPublicKeyField(publicKey) {
    return await allure.step('Fill In Public Key Field', async () => {
      await this.fillByTestId(this.publicKeyComplexInputSelector, publicKey);
    });
  }

  async clickInsertPublicKey() {
    return await allure.step('Click Insert Public Key', async () => {
      await this.clickByTestId(this.insertPublicKeyButtonSelector);
    });
  }

  async clickOnCreateNewComplexKeyButton() {
    return await allure.step('Click On Create New Complex Key Button', async () => {
      await this.clickByTestId(this.spanCreateNewComplexKeyButtonSelector);
    });
  }

  async clickOnComplexTab() {
    return await allure.step('Click On Complex Tab', async () => {
      await this.clickByTestId(this.complexTabSelector);
    });
  }

  async clickOnDoneButton() {
    return await allure.step('Click On Done Button', async () => {
      await this.clickByTestId(this.doneComplexKeyButtonSelector);
    });
  }

  async fillInAccountId(accountId, inputSelector, buttonSelector) {
    return await allure.step('Fill In Account ID', async () => {
      const maxRetries = 100;
      let attempt = 0;

      while (attempt < maxRetries) {
        const { delay } = await import('../utils/util.js');
        const element = this.window.getByTestId(inputSelector);
        await element.fill(accountId);

        const lastChar = accountId.slice(-1);
        const withoutLastChar = accountId.slice(0, -1);

        await element.fill(withoutLastChar);

        await this.window.keyboard.type(lastChar);

        if (await this.isButtonEnabled(buttonSelector)) {
          return;
        }

        await delay(100);

        attempt++;
      }

      throw new Error(
        `Failed to enable the button after multiple attempts. Selector: ${buttonSelector}`,
      );
    });
  }

  async fillInDeletedAccountId(accountId) {
    return await allure.step('Fill In Deleted Account ID', async () => {
      await this.fillInAccountId(
        accountId,
        this.deletedAccountInputSelector,
        this.signAndSubmitDeleteButtonSelector,
      );
    });
  }

  async fillInUpdatedAccountId(accountId) {
    return await allure.step('Fill In Updated Account ID', async () => {
      await this.fillInAccountId(
        accountId,
        this.updateAccountInputSelector,
        this.signAndSubmitUpdateButtonSelector,
      );
    });
  }

  async fillInSpenderAccountId(accountId) {
    return await allure.step('Fill In Spender Account ID', async () => {
      await this.fillInAccountId(
        accountId,
        this.allowanceSpenderAccountSelector,
        this.signAndSubmitAllowanceSelector,
      );
    });
  }

  async fillInSpenderAccountIdNormally(accountId) {
    return await allure.step('Fill In Spender Account ID Normally', async () => {
      await this.fillByTestId(this.allowanceSpenderAccountSelector, accountId);
    });
  }

  async getSpenderAccountId() {
    return await allure.step('Get Spender Account ID', async () => {
      return await this.getTextFromInputFieldByTestId(this.allowanceSpenderAccountSelector);
    });
  }

  async fillInTransferAccountId() {
    return await allure.step('Fill In Transfer Account ID', async () => {
      const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
      const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
      await this.fillByTestId(this.transferAccountInputSelector, firstAccountId);
      return firstAccountId;
    });
  }

  async getFirstAccountIdFromText(allAccountIds) {
    return await allure.step('Get First Account ID From Text', async () => {
      const accountIdsArray = allAccountIds.split(' ');
      return accountIdsArray[0];
    });
  }

  async getPayerAccountId() {
    return await allure.step('Get Payer Account ID', async () => {
      const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
      return await this.getFirstAccountIdFromText(allAccountIdsText);
    });
  }

  async addAccountsToList(accountId) {
    return await allure.step('Add Accounts To List', async () => {
      this.generatedAccounts.push(accountId);
    });
  }

  async removeAccountFromList(accountId) {
    return await allure.step('Remove Account From List', async () => {
      this.generatedAccounts = this.generatedAccounts.filter(id => id !== accountId);
    });
  }

  async addGeneratedFile(fileId, text, publicKey) {
    return await allure.step('Add Generated File', async () => {
      this.generatedFiles[fileId] = { text, publicKey };
    });
  }

  async getTextFromCache(fileId) {
    return await allure.step('Get Text From Cache', async () => {
      const file = this.generatedFiles[fileId];
      return file ? file.text : null;
    });
  }

  async getPublicKeyFromFile(fileId) {
    return await allure.step('Get Public Key From File', async () => {
      const file = this.generatedFiles[fileId];
      return file ? file.publicKey : null;
    });
  }

  async listGeneratedFileKeys() {
    return await allure.step('List Generated File Keys', async () => {
      return Object.keys(this.generatedFiles);
    });
  }

  async getFirsFileIdFromCache() {
    return await allure.step('Get First File ID From Cache', async () => {
      const keys = await this.listGeneratedFileKeys();
      return keys.length > 0 ? keys[0] : null;
    });
  }

  async isGeneratedFilesEmpty() {
    return await allure.step('Is Generated Files Empty', async () => {
      return Object.keys(this.generatedFiles).length === 0;
    });
  }

  async updateFileText(fileId, newText) {
    return await allure.step('Update File Text', async () => {
      if (this.generatedFiles[fileId]) {
        this.generatedFiles[fileId].text = newText;
      } else {
        throw new Error(`File with ID ${fileId} does not exist.`);
      }
    });
  }

  async appendToFileText(fileId, textToAppend) {
    return await allure.step('Append To File Text', async () => {
      if (this.generatedFiles[fileId]) {
        this.generatedFiles[fileId].text += textToAppend;
      } else {
        throw new Error(`File with ID ${fileId} does not exist.`);
      }
    });
  }

  async isAccountsListEmpty() {
    return await allure.step('Is Accounts List Empty', async () => {
      return this.generatedAccounts.length === 0;
    });
  }

  async getFirstAccountFromList() {
    return await allure.step('Get First Account From List', async () => {
      return this.generatedAccounts[0];
    });
  }

  async fillInMaxAutoAssociations(amount) {
    return await allure.step('Fill In Max Auto Associations', async () => {
      await this.fillByTestId(this.maxAutoAssociationsUpdateInputSelector, amount);
    });
  }

  async getFilledMaxAutoAssociationsOnUpdatePage() {
    return await allure.step('Get Filled Max Auto Associations On Update Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.maxAutoAssociationsUpdateInputSelector);
    });
  }

  async fillInMemoUpdate(memo) {
    return await allure.step('Fill In Memo Update', async () => {
      await this.fillByTestId(this.memoUpdateInputSelector, memo);
    });
  }

  async fillInUpdateAccountIdNormally(accountId) {
    return await allure.step('Fill In Update Account ID Normally', async () => {
      await this.fillByTestId(this.updateAccountInputSelector, accountId);
    });
  }

  async fillInDeleteAccountIdNormally(accountId) {
    return await allure.step('Fill In Delete Account ID Normally', async () => {
      await this.fillByTestId(this.deletedAccountInputSelector, accountId);
    });
  }

  async getMemoTextOnUpdatePage() {
    return await allure.step('Get Memo Text On Update Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.memoUpdateInputSelector);
    });
  }

  async fillInTransactionMemoUpdate(memo) {
    return await allure.step('Fill In Transaction Memo Update', async () => {
      await this.fillByTestId(this.transactionMemoUpdateInputSelector, memo);
    });
  }

  async getTransactionMemoText() {
    return await allure.step('Get Transaction Memo Text', async () => {
      return await this.getTextFromInputFieldByTestId(this.transactionMemoUpdateInputSelector);
    });
  }

  async getTransactionMemoTextForDeletePage() {
    return await allure.step('Get Transaction Memo Text For Delete Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.deleteAccountMemoInputSelector);
    });
  }

  async fillInNickname(nickname) {
    return await allure.step('Fill In Nickname', async () => {
      await this.fillByTestId(this.nicknameInputSelector, nickname);
    });
  }

  async fillInTransferFromAccountId() {
    return await allure.step('Fill In Transfer From Account ID', async () => {
      const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
      const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
      await this.fillByTestId(this.transferFromAccountIdInputSelector, firstAccountId);
      return firstAccountId;
    });
  }

  async fillInTransferAmountFromAccount(amount) {
    return await allure.step('Fill In Transfer Amount From Account', async () => {
      await this.fillByTestId(this.transferAmountFromAccountInputSelector, amount);
    });
  }

  async fillInTransferToAccountId(accountId) {
    return await allure.step('Fill In Transfer To Account ID', async () => {
      await this.fillByTestId(this.transferToAccountIdInputSelector, accountId);
    });
  }

  async fillInTransferAmountToAccount(amount) {
    return await allure.step('Fill In Transfer Amount To Account', async () => {
      await this.fillByTestId(this.transferAmountToAccountInputSelector, amount);
    });
  }

  async clickOnAddTransferFromButton() {
    return await allure.step('Click On Add Transfer From Button', async () => {
      await this.clickByTestId(this.addTransferFromButtonSelector);
    });
  }

  async clickOnAddTransferToButton() {
    return await allure.step('Click On Add Transfer To Button', async () => {
      await this.clickByTestId(this.addTransferToButtonSelector);
    });
  }

  async clickOnAddRestButton() {
    return await allure.step('Click On Add Rest Button', async () => {
      await this.clickByTestId(this.addRestButtonSelector);
    });
  }

  async clickOnSignAndSubmitTransferButton() {
    return await allure.step('Click On Sign And Submit Transfer Button', async () => {
      await this.clickByTestId(this.signAndSubmitTransferSelector);
    });
  }

  async getHbarAmountValueForTwoAccounts() {
    return await allure.step('Get HBAR Amount Value For Two Accounts', async () => {
      return await this.getAllTextByTestId(this.hbarAmountValueSelector);
    });
  }

  async isSignAndSubmitButtonEnabled() {
    return await allure.step('Is Sign And Submit Button Enabled', async () => {
      return await this.isButtonEnabled(this.signAndSubmitTransferSelector);
    });
  }

  async fillInAllowanceOwnerAccount() {
    return await allure.step('Fill In Allowance Owner Account', async () => {
      const allAccountIdsText = await this.getTextByTestId(this.payerDropdownSelector);
      const firstAccountId = await this.getFirstAccountIdFromText(allAccountIdsText);
      await this.fillByTestId(this.allowanceOwnerAccountSelector, firstAccountId);
      return firstAccountId;
    });
  }

  async getAllowanceOwnerAccountId() {
    return await allure.step('Get Allowance Owner Account ID', async () => {
      return await this.getTextFromInputFieldByTestId(this.allowanceOwnerAccountSelector);
    });
  }

  async fillInAllowanceAmount(amount) {
    return await allure.step('Fill In Allowance Amount', async () => {
      await this.fillByTestId(this.allowanceAmountSelector, amount);
    });
  }

  async getAllowanceAmount() {
    return await allure.step('Get Allowance Amount', async () => {
      return await this.getTextFromInputFieldByTestId(this.allowanceAmountSelector);
    });
  }

  async clickOnSignAndSubmitAllowanceButton() {
    return await allure.step('Click On Sign And Submit Allowance Button', async () => {
      await this.clickByTestId(this.signAndSubmitAllowanceSelector);
    });
  }

  async isSignAndSubmitCreateAccountButtonVisible() {
    return await allure.step('Is Sign And Submit Create Account Button Visible', async () => {
      return await this.isElementVisible(this.signAndSubmitButtonSelector);
    });
  }

  async isSignAndSubmitUpdateAccountButtonVisible() {
    return await allure.step('Is Sign And Submit Update Account Button Visible', async () => {
      return await this.isElementVisible(this.signAndSubmitUpdateButtonSelector);
    });
  }

  async isTransferAccountIdVisible() {
    return await allure.step('Is Transfer Account ID Visible', async () => {
      return await this.isElementVisible(this.transferAccountInputSelector);
    });
  }

  async getPrefilledAccountIdInUpdatePage() {
    return await allure.step('Get Prefilled Account ID In Update Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.updateAccountInputSelector);
    });
  }

  async getPrefilledAccountIdInDeletePage() {
    return await allure.step('Get Prefilled Account ID In Delete Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.deletedAccountInputSelector);
    });
  }

  async getPrefilledTransferIdAccountInDeletePage() {
    return await allure.step('Get Prefilled Transfer ID Account In Delete Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.transferAccountInputSelector);
    });
  }

  async fillInFileContent(fileContent) {
    return await allure.step('Fill In File Content', async () => {
      await this.fillByTestId(this.fileContentTextFieldSelector, fileContent);
    });
  }

  async getFileContentText() {
    return await allure.step('Get File Content Text', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileContentTextFieldSelector);
    });
  }

  async clickOnSignAndSubmitFileCreateButton() {
    return await allure.step('Click On Sign And Submit File Create Button', async () => {
      await this.clickByTestId(this.signAndSubmitFileCreateSelector, 10000);
    });
  }

  async clickOnFileServiceLink() {
    return await allure.step('Click On File Service Link', async () => {
      await this.clickOnMenuLink(this.fileServiceLinkSelector, 'active', 'File Service');
    });
  }

  async fillInFileIdForRead(fileId) {
    return await allure.step('Fill In File ID For Read', async () => {
      await this.fillByTestId(this.fileIdInputForReadSelector, fileId);
    });
  }

  async getFileIdFromReadPage() {
    return await allure.step('Get File ID From Read Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileIdInputForReadSelector);
    });
  }

  async readFileContentFromTextArea() {
    return await allure.step('Read File Content From Text Area', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileContentReadTextFieldSelector);
    });
  }

  async clickOnSignAndReadFileButton() {
    return await allure.step('Click On Sign And Read File Button', async () => {
      await this.clickByTestId(this.signAndReadFileButtonSelector);
    });
  }

  async fillInPasswordForRead(password) {
    return await allure.step('Fill In Password For Read', async () => {
      await this.fillByTestId(this.signPasswordForReadInputFieldSelector, password);
    });
  }

  async clickOnSignReadQueryButton() {
    return await allure.step('Click On Sign Read Query Button', async () => {
      await this.clickByTestId(this.signReadQueryButtonSelector);
    });
  }

  async getPublicKeyText() {
    return await allure.step('Get Public Key Text', async () => {
      return await this.getTextFromInputFieldByTestIdWithIndex(this.publicKeyInputSelector);
    });
  }

  async fillInFileIdForUpdate(fileId) {
    return await allure.step('Fill In File ID For Update', async () => {
      await this.fillByTestId(this.fileIdUpdateInputSelector, fileId);
    });
  }

  async getFileIdFromUpdatePage() {
    return await allure.step('Get File ID From Update Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileIdUpdateInputSelector);
    });
  }

  async fillInPublicKeyForFile(publicKey) {
    return await allure.step('Fill In Public Key For File', async () => {
      await this.fillByTestIdWithIndex(this.publicKeyInputSelector, publicKey);
    });
  }

  async fillInFileContentForUpdate(fileContent) {
    return await allure.step('Fill In File Content For Update', async () => {
      await this.fillByTestId(this.fileContentUpdateTextFieldSelector, fileContent);
    });
  }

  async clickOnSignAndSubmitUpdateFileButton() {
    return await allure.step('Click On Sign And Submit Update File Button', async () => {
      await this.clickByTestId(this.signAndSubmitUpdateFileSelector);
    });
  }

  async clickOnSignFileButton() {
    return await allure.step('Click On Sign File Button', async () => {
      await this.clickByTestId(this.signFileUpdateButtonSelector);
    });
  }

  async fillInPasswordForFile(password) {
    return await allure.step('Fill In Password For File', async () => {
      await this.fillByTestId(this.signPasswordForFileUpdateInputSelector, password);
    });
  }

  async clickOnContinueSignFileButton() {
    return await allure.step('Click On Continue Sign File Button', async () => {
      await this.clickByTestId(this.continueSignFileUpdateButtonSelector);
    });
  }

  async clickOnSignAndSubmitFileAppendButton() {
    return await allure.step('Click On Sign And Submit File Append Button', async () => {
      await this.clickByTestId(this.signAndSubmitFileAppendButtonSelector);
    });
  }

  async fillInFileIdForAppend(fileId) {
    return await allure.step('Fill In File ID For Append', async () => {
      await this.fillByTestId(this.fileIdInputForAppendSelector, fileId);
    });
  }

  async getFileIdFromAppendPage() {
    return await allure.step('Get File ID From Append Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileIdInputForAppendSelector);
    });
  }

  async fillInFileContentForAppend(fileContent) {
    return await allure.step('Fill In File Content For Append', async () => {
      await this.fillByTestId(this.fileContentAppendTextFieldSelector, fileContent);
    });
  }

  async getTransactionTypeHeaderText() {
    return await allure.step('Get Transaction Type Header Text', async () => {
      return await this.getTextByTestId(this.transactionTypeHeaderSelector);
    });
  }

  async clickOnSaveDraftButton() {
    return await allure.step('Click On Save Draft Button', async () => {
      await this.clickByTestId(this.saveDraftButtonSelector);
    });
  }

  async clickOnDraftsMenuButton() {
    return await allure.step('Click On Drafts Menu Button', async () => {
      await this.clickByTestId(this.draftsTabSelector);
    });
  }

  async fillInDeleteAccountTransactionMemo(memo) {
    return await allure.step('Fill In Delete Account Transaction Memo', async () => {
      await this.fillByTestId(this.deleteAccountMemoInputSelector, memo);
    });
  }

  async fillInTransactionMemoForApprovePage(memo) {
    return await allure.step('Fill In Transaction Memo For Approve Page', async () => {
      await this.fillByTestId(this.approveAllowanceTransactionMemoSelector, memo);
    });
  }

  async getTransactionMemoFromApprovePage() {
    return await allure.step('Get Transaction Memo From Approve Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.approveAllowanceTransactionMemoSelector);
    });
  }

  async fillInTransactionMemoForCreateFilePage(memo) {
    return await allure.step('Fill In Transaction Memo For Create File Page', async () => {
      await this.fillByTestId(this.fileCreateTransactionMemoInputSelector, memo);
    });
  }

  async getTransactionMemoFromFilePage() {
    return await allure.step('Get Transaction Memo From File Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileCreateTransactionMemoInputSelector);
    });
  }

  async fillInFileMemoForCreatePage(memo) {
    return await allure.step('Fill In File Memo For Create Page', async () => {
      await this.fillByTestId(this.fileCreateMemoInputSelector, memo);
    });
  }

  async getFileMemoFromCreatePage() {
    return await allure.step('Get File Memo From Create Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileCreateMemoInputSelector);
    });
  }

  async fillInTransactionMemoForFileUpdatePage(memo) {
    return await allure.step('Fill In Transaction Memo For File Update Page', async () => {
      await this.fillByTestId(this.fileUpdateTransactionMemoInputSelector, memo);
    });
  }

  async getTransactionMemoFromFileUpdatePage() {
    return await allure.step('Get Transaction Memo From File Update Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileUpdateTransactionMemoInputSelector);
    });
  }

  async fillInTransactionMemoForFileAppendPage(memo) {
    return await allure.step('Fill In Transaction Memo For File Append Page', async () => {
      await this.fillByTestId(this.fileAppendTransactionMemoInputSelector, memo);
    });
  }

  async getTransactionMemoFromFileAppendPage() {
    return await allure.step('Get Transaction Memo From File Append Page', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileAppendTransactionMemoInputSelector);
    });
  }

  async fillInFileUpdateMemo(memo) {
    return await allure.step('Fill In File Update Memo', async () => {
      await this.fillByTestId(this.fileUpdateMemoInputSelector, memo);
    });
  }

  async getFileUpdateMemo() {
    return await allure.step('Get File Update Memo', async () => {
      return await this.getTextFromInputFieldByTestId(this.fileUpdateMemoInputSelector);
    });
  }

  async getNewAccountIdDetailsText() {
    return await allure.step('Get New Account ID Details Text', async () => {
      return await this.getTextByTestId(this.newAccountIdDetailsSelector, 15000);
    });
  }

  async getFirstTransactionStatus() {
    return await allure.step('Get First Transaction Status', async () => {
      return await this.getTextByTestId(this.transactionStatusIndexSelector + '0');
    });
  }

  async getFirstDraftDate() {
    return await allure.step('Get First Draft Date', async () => {
      return await this.getTextByTestId(this.draftDetailsDateIndexSelector + '0');
    });
  }

  async getFirstDraftType() {
    return await allure.step('Get First Draft Type', async () => {
      return await this.getTextByTestId(this.draftDetailsTypeIndexSelector + '0');
    });
  }

  async getFirstDraftIsTemplateCheckboxVisible() {
    return await allure.step('Get First Draft Is Template Checkbox Visible', async () => {
      return await this.isElementVisible(this.draftDetailsIsTemplateCheckboxSelector + '0');
    });
  }

  async clickOnFirstDraftIsTemplateCheckbox() {
    return await allure.step('Click On First Draft Is Template Checkbox', async () => {
      await this.clickByTestId(this.draftDetailsIsTemplateCheckboxSelector + '0');
    });
  }

  async clickOnFirstDraftDeleteButton() {
    return await allure.step('Click On First Draft Delete Button', async () => {
      await this.clickByTestId(this.draftDeleteButtonIndexSelector + '0');
    });
  }

  async isFirstDraftDeleteButtonVisible() {
    return await allure.step('Is First Draft Delete Button Visible', async () => {
      return await this.isElementVisible(this.draftDeleteButtonIndexSelector + '0');
    });
  }

  async clickOnFirstDraftContinueButton() {
    return await allure.step('Click On First Draft Continue Button', async () => {
      await this.clickByTestId(this.draftContinueButtonIndexSelector + '0');
    });
  }

  async isFirstDraftContinueButtonVisible() {
    return await allure.step('Is First Draft Continue Button Visible', async () => {
      return await this.isElementVisible(this.draftContinueButtonIndexSelector + '0');
    });
  }

  async saveDraft() {
    return await allure.step('Save Draft', async () => {
      await this.clickOnSaveDraftButton();
      await this.clickOnTransactionsMenuButton();
      await this.closeDraftModal();
      await this.clickOnDraftsMenuButton();
    });
  }

  async deleteFirstDraft() {
    return await allure.step('Delete First Draft', async () => {
      await this.clickOnFirstDraftDeleteButton();
      await this.waitForElementToDisappear(this.toastMessageSelector);
    });
  }

  async navigateToDrafts() {
    return await allure.step('Navigate To Drafts', async () => {
      await this.clickOnTransactionsMenuButton();
      await this.closeDraftModal();
      await this.clickOnDraftsMenuButton();
    });
  }

  async waitForPublicKeyToBeFilled() {
    return await allure.step('Wait For Public Key To Be Filled', async () => {
      await this.waitForInputFieldToBeFilled(this.publicKeyInputSelector, 1);
    });
  }

  async turnReceiverSigSwitchOn() {
    return await allure.step('Turn Receiver Signature Switch On', async () => {
      const maxAttempts = 10;
      const interval = 500;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const isToggledOn = await this.isReceiverSigRequiredSwitchToggledOnForUpdatePage();
        if (isToggledOn) {
          console.log(`Receiver signature switch is turned on.`);
          return;
        } else {
          console.log(
            `Attempt ${attempts + 1}: Receiver signature switch is off, toggling it on...`,
          );
          await this.clickONReceiverSigRequiredSwitchForUpdate();
          attempts++;
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      throw new Error('Failed to turn the receiver signature switch on after multiple attempts');
    });
  }
}
module.exports = TransactionPage;
