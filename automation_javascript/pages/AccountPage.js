import { deleteAccountById } from '../utils/databaseQueries';

const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');

class AccountPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.unlikedAccounts = []; // Store unliked accounts
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */

  // Buttons
  editButtonSelector = 'button-edit-account';
  removeButtonSelector = 'button-remove-account-card';
  removeMultipleButtonSelector = 'button-remove-multiple-accounts';
  addNewButtonSelector = 'button-add-new-account';
  createNewLinkSelector = 'link-create-new-account';
  addExistingLinkSelector = 'link-add-existing-account';
  accountsLinkSelector = 'button-menu-accounts';
  deleteFromNetworkLinkSelector = 'button-delete-from-network';
  updateInNetworkLinkSelector = 'button-update-in-network';
  confirmUnlinkButtonSelector = 'button-confirm-unlink-account';
  linkAccountButtonSelector = 'button-link-account-id';
  selectManyAccountsButtonSelector = 'button-select-many-accounts';

  // Texts
  accountIdTextSelector = 'p-account-data-account-id';
  evmAddressTextSelector = 'p-account-data-evm-address';
  balanceTextSelector = 'p-account-data-balance';
  keyTextSelector = 'p-account-data-key';
  keyTypeTextSelector = 'p-account-data-key-type';
  receiverSigRequiredTextSelector = 'p-account-data-receiver-sig-required';
  memoTextSelector = 'p-account-data-memo';
  maxAutoAssocTextSelector = 'p-account-data-max-auto-association';
  ethereumNonceTextSelector = 'p-account-data-eth-nonce';
  createdAtTextSelector = 'p-account-data-created-at';
  expiresAtTextSelector = 'p-account-data-expires-at';
  autoRenewPeriodTextSelector = 'p-account-data-auto-renew-period';
  stakedToTextSelector = 'p-account-data-staked-to';
  pendingRewardTextSelector = 'p-account-data-pending-reward';
  rewardsTextSelector = 'p-account-data-rewards';

  // Inputs
  existingAccountIdInputSelector = 'input-existing-account-id';
  multiSelectCheckboxSelector = 'checkbox-multiple-account-id-';

  async clickOnEditButton() {
    await this.click(this.editButtonSelector);
  }

  async clickOnRemoveButton() {
    await this.click(this.removeButtonSelector);
  }

  async clickOnRemoveMultipleButton() {
    await this.click(this.removeMultipleButtonSelector);
  }

  async clickOnAddNewButton() {
    await this.click(this.addNewButtonSelector);
  }

  async clickOnCreateNewLink() {
    await this.click(this.createNewLinkSelector);
  }

  async clickOnAddExistingLink() {
    await this.click(this.addExistingLinkSelector);
  }

  async clickOnAccountsLink() {
    await this.click(this.accountsLinkSelector);
  }

  async getAccountIdText() {
    return await this.getText(this.accountIdTextSelector);
  }

  async getEvmAddressText() {
    return await this.getText(this.evmAddressTextSelector);
  }

  async getBalanceText() {
    return await this.getText(this.balanceTextSelector);
  }

  async getKeyText() {
    return await this.getText(this.keyTextSelector);
  }

  async getKeyTypeText() {
    return await this.getText(this.keyTypeTextSelector);
  }

  async getReceiverSigRequiredText() {
    return await this.getText(this.receiverSigRequiredTextSelector);
  }

  async getMemoText() {
    return await this.getText(this.memoTextSelector);
  }

  async getMaxAutoAssocText() {
    return await this.getText(this.maxAutoAssocTextSelector);
  }

  async getEthereumNonceText() {
    return await this.getText(this.ethereumNonceTextSelector);
  }

  async getCreatedAtText() {
    return await this.getText(this.createdAtTextSelector);
  }

  async getExpiresAtText() {
    return await this.getText(this.expiresAtTextSelector);
  }

  async getAutoRenewPeriodText() {
    return await this.getText(this.autoRenewPeriodTextSelector);
  }

  async getStakedToText() {
    return await this.getText(this.stakedToTextSelector);
  }

  async getPendingRewardText() {
    return await this.getText(this.pendingRewardTextSelector);
  }

  async getRewardsText() {
    return await this.getText(this.rewardsTextSelector);
  }

  async clickOnDeleteFromNetworkLink() {
    await this.click(this.deleteFromNetworkLinkSelector);
  }

  async clickOnUpdateInNetworkLink() {
    await this.click(this.updateInNetworkLinkSelector);
  }

  async addAccountToUnliked(accountId) {
    this.unlikedAccounts.push(accountId);
  }

  async unlinkAccounts() {
    await this.waitForElementToBeVisible(this.confirmUnlinkButtonSelector);
    await this.click(this.confirmUnlinkButtonSelector);
  }

  async fillInExistingAccountId(accountId) {
    await this.fillInAccountId(
      accountId,
      this.existingAccountIdInputSelector,
      this.linkAccountButtonSelector,
    );
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
      await new Promise(resolve => setTimeout(resolve, 100));

      attempt++; // Increment the attempt counter
    }

    throw new Error(
      `Failed to enable the button after multiple attempts. Selector: ${buttonSelector}`,
    );
  }

  async clickOnLinkAccountButton() {
    await this.click(this.linkAccountButtonSelector);
  }

  async isUnlinkedAccountsListEmpty() {
    return this.unlikedAccounts.length === 0;
  }

  async getFirstAccountFromUnlinkedList() {
    return this.unlikedAccounts[0];
  }

  async ensureAccountExistsAndUnlinked() {
    if (await this.isUnlinkedAccountsListEmpty()) {
      const { newAccountId } = await this.transactionPage.createNewAccount();
      await this.transactionPage.mirrorGetAccountResponse(newAccountId);
      await this.transactionPage.clickOnTransactionsMenuButton();
      // await this.clickOnAccountsLink();
      // await this.clickOnRemoveButton();
      // await this.unlinkAccounts(newAccountId);
      await deleteAccountById(newAccountId);
      await this.addAccountToUnliked(newAccountId);
    }
  }

  async clickOnAccountCheckbox(accountId) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const index = await this.transactionPage.findAccountIndexById(accountId);
    await this.click(this.multiSelectCheckboxSelector + index);
  }

  async clickOnSelectManyAccountsButton() {
    await this.click(this.selectManyAccountsButtonSelector);
  }
}

module.exports = AccountPage;
