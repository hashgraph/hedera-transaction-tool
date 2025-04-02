const path = require('path');
const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');
const OrganizationPage = require('./OrganizationPage');
const { getTransactionGroupsForTransactionId } = require('../utils/databaseQueries');
const { generateCSVFile } = require('../utils/csvGenerator');

class GroupPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.transactionPage = new TransactionPage(window);
    this.organizationPage = new OrganizationPage(window);
  }

  /* Selectors */

  // Buttons
  saveGroupButtonSelector = 'button-save-group';
  signAndExecuteButtonSelector = 'button-sign-submit';
  addTransactionButtonSelector = 'button-add-transaction';
  transactionGroupButtonSelector = 'span-group-transaction';
  deleteGroupButtonSelector = 'button-delete-group-modal';
  continueEditingButtonSelector = 'button-continue-editing';
  addToGroupButtonSelector = 'button-add-to-group';
  discardModalDraftButtonSelector = 'button-discard-group-modal';
  discardDraftTransactionModalButtonSelector = 'button-discard-draft-for-group-modal';
  deleteAllButtonSelector = 'button-delete-all';
  confirmDeleteAllButtonSelector = 'button-confirm-delete-all';
  confirmGroupTransactionButtonSelector = 'button-confirm-group-transaction';
  detailsGroupButtonSelector = 'button-group-details-';
  importCsvButtonSelector = 'button-import-csv';

  // Text
  toastMessageSelector = '.v-toast__text';
  emptyTransactionTextSelector = 'p-empty-transaction-text';
  transactionGroupDetailsIdSelector = 'td-group-transaction-id';

  // Inputs
  descriptionInputSelector = 'input-transaction-group-description';

  //Indexes
  transactionTypeIndexSelector = 'span-transaction-type-';
  transactionTimestampIndexSelector = 'div-transaction-id-';
  transactionDeleteButtonIndexSelector = 'button-transaction-delete-';
  transactionDuplicateButtonIndexSelector = 'button-transaction-duplicate-';
  transactionEditButtonIndexSelector = 'button-transaction-edit-';
  orgTransactionDetailsButtonIndexSelector = 'button-group-transaction-';

  async closeModalIfVisible(selector) {
    const modalButton = this.window.getByTestId(selector);

    await modalButton.waitFor({ state: 'visible', timeout: 500 }).catch(e => {});

    if (await modalButton.isVisible()) {
      await modalButton.click();
    }
  }

  async deleteGroupModal() {
    await this.closeModalIfVisible(this.deleteGroupButtonSelector);
  }

  async closeGroupDraftModal() {
    await this.closeModalIfVisible(this.discardModalDraftButtonSelector);
  }

  async closeDraftTransactionModal() {
    await this.closeModalIfVisible(this.discardDraftTransactionModalButtonSelector);
  }

  async clickOnSaveGroupButton() {
    await this.click(this.saveGroupButtonSelector);
  }

  async clickOnSignAndExecuteButton() {
    await this.click(this.signAndExecuteButtonSelector);
  }

  async clickOnAddTransactionButton() {
    await this.click(this.addTransactionButtonSelector);
  }

  async fillDescription(description) {
    await this.fill(this.descriptionInputSelector, description);
  }

  async verifyGroupElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.saveGroupButtonSelector),
      this.isElementVisible(this.signAndExecuteButtonSelector),
      this.isElementVisible(this.addTransactionButtonSelector),
      this.isElementVisible(this.descriptionInputSelector),
    ]);

    return checks.every(isTrue => isTrue);
  }

  async navigateToGroupTransaction() {
    await this.click(this.transactionPage.createNewTransactionButtonSelector);
    await this.click(this.transactionGroupButtonSelector);
  }

  async clickOnDeleteGroupButton() {
    await this.click(this.deleteGroupButtonSelector);
  }

  async clickOnContinueEditingButton() {
    await this.click(this.continueEditingButtonSelector);
  }

  async isDeleteModalVisible() {
    return this.isElementVisible(this.deleteGroupButtonSelector);
  }

  async getToastMessage() {
    return await this.getText(this.toastMessageSelector, null, 5000);
  }

  async clickAddToGroupButton() {
    await this.click(this.addToGroupButtonSelector);
  }

  async getTransactionType(index) {
    return await this.getText(this.transactionTypeIndexSelector + index);
  }

  async getTransactionTimestamp(index) {
    return await this.getText(this.transactionTimestampIndexSelector + index);
  }

  async getTransactionGroupDetailsId(index) {
    return await this.getText(this.transactionGroupDetailsIdSelector, index);
  }

  async getAllTransactionTimestamps(numberOfTransactions) {
    const timestamps = [];
    for (let i = 0; i < numberOfTransactions; i++) {
      timestamps.push(await this.getTransactionGroupDetailsId(i));
    }
    return timestamps;
  }

  async verifyAllTransactionsAreSuccessful(timestampsForVerification) {
    for (let i = 0; i < timestampsForVerification.length; i++) {
      const transactionDetails = await this.transactionPage.mirrorGetTransactionResponse(
        timestampsForVerification[i],
      );
      const result = transactionDetails.transactions[0]?.result;
      if (result !== 'SUCCESS') {
        return false;
      }
    }
    return true;
  }

  async clickTransactionDeleteButton(index) {
    await this.click(this.transactionDeleteButtonIndexSelector + index);
  }

  async clickTransactionDuplicateButton(index) {
    await this.click(this.transactionDuplicateButtonIndexSelector + index);
  }

  async clickTransactionEditButton(index) {
    await this.click(this.transactionEditButtonIndexSelector + index);
  }

  async isTransactionVisible(index) {
    return this.isElementVisible(this.transactionTypeIndexSelector + index);
  }

  async addSingleTransactionToGroup(numberOfTransactions = 1, isFileTransaction = false) {
    if (isFileTransaction) {
      await this.clickOnAddTransactionButton();
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnFileCreateTransaction();
      await this.clickAddToGroupButton();
    } else {
      await this.fillDescription('test');
      for (let i = 0; i < numberOfTransactions; i++) {
        await this.clickOnAddTransactionButton();
        await this.transactionPage.clickOnCreateAccountTransaction();
        await this.clickAddToGroupButton();
      }
    }
  }

  async generateAndImportCsvFile(fromAccountId, numberOfTransactions = 10) {
    const fileName = 'groupTransactions.csv';
    const receiverAccount = '0.0.1031';
    await generateCSVFile({
      senderAccount: fromAccountId,
      accountId: receiverAccount,
      startingAmount: 1,
      numberOfTransactions: numberOfTransactions,
      fileName: fileName,
    });
    await this.uploadFile(
      this.importCsvButtonSelector,
      path.resolve(__dirname, '..', 'data', fileName),
    );
  }

  async addOrgAllowanceTransactionToGroup(numberOfTransactions = 1, allowanceOwner, amount) {
    await this.fillDescription('test');
    for (let i = 0; i < numberOfTransactions; i++) {
      await this.clickOnAddTransactionButton();
      await this.transactionPage.clickOnApproveAllowanceTransaction();
      await this.transactionPage.fillInMaxTransactionFee('5');

      await this.transactionPage.fillInAllowanceOwner(allowanceOwner);
      await this.transactionPage.fillInAllowanceAmount(amount);
      await this.transactionPage.fillInSpenderAccountId(
        await this.getTextFromInputField(this.transactionPage.payerDropdownSelector),
        this.addToGroupButtonSelector,
      );

      await this.clickAddToGroupButton();
    }
  }

  async isEmptyTransactionTextVisible() {
    return this.isElementVisible(this.emptyTransactionTextSelector);
  }

  async clickOnDeleteAllButton() {
    await this.click(this.deleteAllButtonSelector);
  }

  async clickOnConfirmDeleteAllButton() {
    await this.click(this.confirmDeleteAllButtonSelector);
  }

  async clickOnConfirmGroupTransactionButton() {
    await this.click(this.confirmGroupTransactionButtonSelector);
  }

  /**
   * Checks if transaction groups exist for the given transaction ID.
   *
   * @param {string} transactionId - The ID of the transaction to check.
   * @returns {Promise<boolean>} A promise that resolves to true if transaction groups exist, otherwise false.
   */
  async doTransactionGroupsExist(transactionId) {
    return !!(await getTransactionGroupsForTransactionId(transactionId));
  }

  async clickOnDetailsGroupButton(index) {
    await this.click(this.detailsGroupButtonSelector + index);
  }

  async clickOnTransactionDetailsButton(index) {
    await this.click(this.orgTransactionDetailsButtonIndexSelector + index);
  }

  async logInAndSignGroupTransactionsByAllUsers(encryptionPassword) {
    for (let i = 1; i < this.organizationPage.users.length; i++) {
      console.log(`Signing transaction for user ${i}`);
      const user = this.organizationPage.users[i];
      await this.organizationPage.signInOrganization(user.email, user.password, encryptionPassword);
      await this.transactionPage.clickOnTransactionsMenuButton();
      await this.organizationPage.clickOnReadyToSignTab();
      await this.clickOnDetailsGroupButton(0);
      await this.clickOnTransactionDetailsButton(0);

      // Initially sign the first transaction
      await this.organizationPage.clickOnSignTransactionButton();

      // After signing, we check if there's a "Next" button to continue to the next transaction
      let hasNext = await this.isElementVisible(
        this.organizationPage.nextTransactionButtonSelector,
      );

      while (hasNext) {
        // Click on the "Next" button to move to the next transaction
        await this.click(this.organizationPage.nextTransactionButtonSelector);

        // Now the button transforms into "Sign" for the next transaction
        // Sign this transaction as well
        await this.organizationPage.clickOnSignTransactionButton();

        // Check again if there's another transaction after this one
        hasNext = await this.isElementVisible(this.organizationPage.nextTransactionButtonSelector);
      }

      await this.organizationPage.logoutFromOrganization();
    }
  }

  async clickOnSignAllButton(retries = 3, retryDelay = 1000) {
    const selector = this.organizationPage.signAllTransactionsButtonSelector;

    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`Attempt ${attempt}/${retries} to click "Sign All" button.`);

      try {
        await this.click(selector);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const isButtonVisible = await this.isElementVisible(selector, null, 3000);

        if (!isButtonVisible) {
          return;
        }

      } catch (error) {
        console.error(`Attempt #${attempt} to click "Sign All" button failed: ${error.message}`);
      }
    }
  }
}

module.exports = GroupPage;
