const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');
const { getTransactionGroupsForTransactionId } = require('../utils/databaseQueries');

class GroupPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.transactionPage = new TransactionPage(window);
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

  // Messages
  toastMessageSelector = '.v-toast__text';
  emptyTransactionTextSelector = 'p-empty-transaction-text';

  // Inputs
  descriptionInputSelector = 'input-transaction-group-description';

  //Indexes
  transactionTypeIndexSelector = 'span-transaction-type-';
  transactionTimestampIndexSelector = 'span-transaction-timestamp-';
  transactionDeleteButtonIndexSelector = 'button-transaction-delete-';
  transactionDuplicateButtonIndexSelector = 'button-transaction-duplicate-';
  transactionEditButtonIndexSelector = 'button-transaction-edit-';

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
}

module.exports = GroupPage;
